"""Authentication and User Management Service with OTP Verification and RBAC."""
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from pydantic import BaseModel

from config import settings
from schemas.auth import UserRole
from services.email_service import email_service
from services.authority_store import authority_store, AuthorityRecord

logger = logging.getLogger("crisis-command.auth")

JWT_SECRET = "crisis-command-ultra-secure-jwt-secret-key-2026-auth"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
OTP_EXPIRATION_MINUTES = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
INCIDENT_SUBMISSION_COOLDOWN_SECONDS = 5


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("utf-8"))


class UserRecord(BaseModel):
    id: str
    name: str
    email: str
    password_hash: str
    salt: str
    role: str = UserRole.USER.value
    is_verified: bool = False
    created_at: datetime
    last_incident_time: Optional[datetime] = None
    otp_hash: Optional[str] = None
    otp_expires_at: Optional[datetime] = None


class OTPRecord(BaseModel):
    email: str
    otp_hash: str
    salt: str
    created_at: datetime
    expires_at: datetime
    attempts: int = 0
    last_sent_at: datetime
    is_used: bool = False


class AuthService:
    """Manages user identity, password hashing, OTP verification lifecycle, and JWTs."""

    def __init__(self, jwt_secret: str = JWT_SECRET):
        self.jwt_secret = jwt_secret
        self._users: Dict[str, UserRecord] = {}  # user_id -> UserRecord (Citizen users only)
        self._users_by_email: Dict[str, str] = {}  # email -> user_id
        self._otps: Dict[str, OTPRecord] = {}  # email -> OTPRecord

    # -------------------------------------------------------------------------
    # Cryptographic Helpers
    # -------------------------------------------------------------------------

    def _hash_password(self, password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000
        ).hex()

    def _generate_otp(self) -> str:
        """Generate a cryptographically secure 6-digit numeric OTP."""
        return f"{secrets.randbelow(900000) + 100000:06d}"

    def _hash_otp(self, otp: str, salt: str) -> str:
        """Never store OTP in plaintext; store SHA-256 hash with salt."""
        return hashlib.sha256(f"{otp}:{salt}:{self.jwt_secret}".encode("utf-8")).hexdigest()

    # -------------------------------------------------------------------------
    # JWT Generation and Verification
    # -------------------------------------------------------------------------

    def create_jwt_token(self, user: UserRecord) -> str:
        """Generate signed JWT token containing user identity and role."""
        now = int(time.time())
        exp = now + (JWT_EXPIRATION_HOURS * 3600)
        payload = {
            "sub": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "is_verified": user.is_verified,
            "iat": now,
            "exp": exp,
        }
        header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
        header_b64 = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        payload_b64 = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        message = f"{header_b64}.{payload_b64}".encode("utf-8")
        signature = hmac.new(self.jwt_secret.encode("utf-8"), message, hashlib.sha256).digest()
        signature_b64 = _base64url_encode(signature)
        return f"{header_b64}.{payload_b64}.{signature_b64}"

    def decode_jwt_token(self, token: str) -> Dict[str, Any]:
        """Decode and verify signature and expiry of JWT token."""
        parts = token.strip().split(".")
        if len(parts) != 3:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token structure.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        header_b64, payload_b64, signature_b64 = parts
        message = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(self.jwt_secret.encode("utf-8"), message, hashlib.sha256).digest()
        try:
            actual_sig = _base64url_decode(signature_b64)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature format.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed token payload.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check expiration
        exp = payload.get("exp")
        if exp and int(time.time()) > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please login again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    # -------------------------------------------------------------------------
    # User Registration & OTP Lifecycle
    # -------------------------------------------------------------------------

    def register_user(self, name: str, email: str, password: str) -> Tuple[UserRecord, int]:
        """Register a new USER, generate OTP, send email, and return record (never returning plain OTP)."""
        clean_email = email.strip().lower()
        if clean_email in self._users_by_email:
            existing_id = self._users_by_email[clean_email]
            existing_user = self._users[existing_id]
            if existing_user.is_verified:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )
            # If account exists but is unverified, allow re-triggering OTP
            user = existing_user
            user.name = name.strip()
            salt = secrets.token_hex(16)
            user.salt = salt
            user.password_hash = self._hash_password(password, salt)
        else:
            user_id = f"usr-{secrets.token_hex(6)}"
            salt = secrets.token_hex(16)
            pwd_hash = self._hash_password(password, salt)
            user = UserRecord(
                id=user_id,
                name=name.strip(),
                email=clean_email,
                password_hash=pwd_hash,
                salt=salt,
                role=UserRole.USER.value,  # Public registration is strictly USER role
                is_verified=False,
                created_at=_utc_now(),
            )
            self._users[user_id] = user
            self._users_by_email[clean_email] = user_id

        # Generate and dispatch OTP
        cooldown = self._issue_otp(user)
        return user, cooldown

    def resend_otp(self, email: str) -> int:
        """Resend OTP subject to cooldown and invalidate previous OTP."""
        clean_email = email.strip().lower()
        if clean_email not in self._users_by_email:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User with this email not found.",
            )
        user_id = self._users_by_email[clean_email]
        user = self._users[user_id]

        if user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already verified. You can login directly.",
            )

        # Check resend cooldown
        now = _utc_now()
        existing_otp = self._otps.get(clean_email)
        if existing_otp and not existing_otp.is_used:
            elapsed = (now - existing_otp.last_sent_at).total_seconds()
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
                remaining = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {remaining} seconds before requesting another code.",
                )

        cooldown = self._issue_otp(user)
        return cooldown

    def _issue_otp(self, user: UserRecord) -> int:
        """Internal helper to generate, hash, store, and dispatch OTP."""
        now = _utc_now()
        plain_otp = self._generate_otp()
        salt = secrets.token_hex(16)
        otp_hash = self._hash_otp(plain_otp, salt)
        expires_at = now + timedelta(minutes=OTP_EXPIRATION_MINUTES)

        # Invalidate previous OTP immediately and store new hash record
        self._otps[user.email] = OTPRecord(
            email=user.email,
            otp_hash=otp_hash,
            salt=salt,
            created_at=now,
            expires_at=expires_at,
            attempts=0,
            last_sent_at=now,
            is_used=False,
        )

        user.otp_hash = otp_hash
        user.otp_expires_at = expires_at

        # Send via email service (never logging the code to stdout/production logs)
        sent = email_service.send_otp_email(user.email, plain_otp, user.name)
        if not sent:
            logger.error("Failed to send OTP verification email to destination: %s", user.email)
            if not email_service.is_configured:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Email delivery service is not configured. Please contact the administrator.",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification code email. Please verify the email address or SMTP server settings.",
            )

        return OTP_RESEND_COOLDOWN_SECONDS

    def verify_otp(self, email: str, candidate_otp: str) -> Tuple[UserRecord, str]:
        """Verify user OTP code, mark email as verified, and issue access JWT."""
        clean_email = email.strip().lower()
        if clean_email not in self._users_by_email:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid verification request.",
            )
        user_id = self._users_by_email[clean_email]
        user = self._users[user_id]

        otp_record = self._otps.get(clean_email)
        if not otp_record or otp_record.is_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active verification code found. Please request a new code.",
            )

        now = _utc_now()
        effective_expiry = user.otp_expires_at if user.otp_expires_at else otp_record.expires_at

        # 1. Expiry check (5 minutes)
        if now > effective_expiry:
            otp_record.is_used = True  # Invalidate expired OTP
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new code.",
            )

        # 2. Max attempts check (5 attempts)
        if otp_record.attempts >= OTP_MAX_ATTEMPTS:
            otp_record.is_used = True
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Maximum verification attempts exceeded. Please request a new code.",
            )

        # Increment attempt counter
        otp_record.attempts += 1

        # 3. Hash candidate and compare
        expected_hash = self._hash_otp(candidate_otp.strip(), otp_record.salt)
        if not hmac.compare_digest(expected_hash, otp_record.otp_hash):
            remaining = max(0, OTP_MAX_ATTEMPTS - otp_record.attempts)
            if remaining == 0:
                otp_record.is_used = True
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Maximum verification attempts exceeded. Please request a new code.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification code. {remaining} attempt(s) remaining.",
            )

        # 4. Mark verified and invalidate OTP
        otp_record.is_used = True
        user.is_verified = True

        token = self.create_jwt_token(user)
        return user, token

    # -------------------------------------------------------------------------
    # User Login
    # -------------------------------------------------------------------------

    def login_user(self, email: str, password: str) -> Tuple[UserRecord, str]:
        """Authenticate user, verify password, ensure verified email, and issue JWT."""
        clean_email = email.strip().lower()
        if clean_email not in self._users_by_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        user_id = self._users_by_email[clean_email]
        user = self._users[user_id]

        expected_hash = self._hash_password(password, user.salt)
        if not hmac.compare_digest(expected_hash, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        # Only verified users can log in
        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email is not verified. Please complete OTP verification before logging in.",
            )

        token = self.create_jwt_token(user)
        return user, token

    def login_authority(self, email: str, password: str) -> Tuple[UserRecord, str]:
        """Authenticate authority operator against the DB-backed authority account."""
        # Delegate to authority_store which handles DB lookup + hash comparison
        auth_rec = authority_store.authenticate(email, password)

        # Wrap in a UserRecord so the rest of the JWT pipeline stays unchanged
        user_record = UserRecord(
            id=auth_rec.id,
            name=auth_rec.name,
            email=auth_rec.email,
            password_hash="",  # Never expose hash
            salt="",
            role=UserRole.AUTHORITY.value,
            is_verified=True,
            created_at=auth_rec.created_at,
        )
        token = self.create_jwt_token(user_record)
        return user_record, token

    def get_user_by_id(self, user_id: str) -> Optional[UserRecord]:
        # Check citizen users first
        citizen = self._users.get(user_id)
        if citizen:
            return citizen

        # Check DB-backed authority accounts
        auth_rec = authority_store.get_by_id(user_id)
        if auth_rec:
            return UserRecord(
                id=auth_rec.id,
                name=auth_rec.name,
                email=auth_rec.email,
                password_hash="",
                salt="",
                role=UserRole.AUTHORITY.value,
                is_verified=True,
                created_at=auth_rec.created_at,
            )

        return None

    def get_user_by_email(self, email: str) -> Optional[UserRecord]:
        clean_email = email.strip().lower()
        user_id = self._users_by_email.get(clean_email)
        if not user_id:
            return None
        return self._users.get(user_id)

    def check_incident_rate_limit(self, user_id: str) -> None:
        """Anti-abuse cooldown for incident reporting."""
        user = self._users.get(user_id)
        if not user:
            return
        now = _utc_now()
        if user.last_incident_time:
            elapsed = (now - user.last_incident_time).total_seconds()
            if elapsed < INCIDENT_SUBMISSION_COOLDOWN_SECONDS:
                remaining = int(INCIDENT_SUBMISSION_COOLDOWN_SECONDS - elapsed) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Incident submission rate limit. Please wait {remaining} seconds before submitting another incident.",
                )
        user.last_incident_time = now


auth_service = AuthService()
