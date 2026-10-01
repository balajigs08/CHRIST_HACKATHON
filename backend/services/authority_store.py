"""Authority Account Store — Database-backed Authority Registration & Authentication.

Authority credentials are stored in MongoDB as hashed records, never in environment variables.
Public registration ALWAYS forces role=user; this store is only reachable via the dedicated
authority registration endpoint and is NOT exposed to the normal user registration path.

Collection: authority_accounts
"""
import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import HTTPException, status

logger = logging.getLogger("crisis-command.authority-store")

AUTHORITY_COLLECTION = "authority_accounts"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuthorityRecord:
    """In-memory representation of a database authority account (no plaintext password)."""

    __slots__ = ("id", "name", "email", "password_hash", "salt", "role", "is_verified", "created_at")

    def __init__(
        self,
        id: str,
        name: str,
        email: str,
        password_hash: str,
        salt: str,
        is_verified: bool = True,
        created_at: Optional[datetime] = None,
    ):
        self.id = id
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.salt = salt
        self.role = "authority"
        self.is_verified = is_verified
        self.created_at = created_at or _utc_now()

    def to_dict(self) -> dict:
        return {
            "_id": self.id,
            "name": self.name,
            "email": self.email,
            "password_hash": self.password_hash,
            "salt": self.salt,
            "role": self.role,
            "is_verified": self.is_verified,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, doc: dict) -> "AuthorityRecord":
        return cls(
            id=doc.get("_id") or doc.get("id", ""),
            name=doc.get("name", "Regional Emergency Authority"),
            email=doc.get("email", ""),
            password_hash=doc.get("password_hash", ""),
            salt=doc.get("salt", ""),
            is_verified=doc.get("is_verified", True),
            created_at=doc.get("created_at"),
        )


class AuthorityStore:
    """Manages DB-backed authority account persistence and lookup.

    Works with or without a live database connection; falls back to an in-memory
    dict so that tests and local development always function correctly.
    """

    def __init__(self):
        self._db = None  # set via set_database()
        self._cache: dict[str, AuthorityRecord] = {}  # email → AuthorityRecord
        self._jwt_secret = "crisis-command-ultra-secure-jwt-secret-key-2026-auth"

    # ------------------------------------------------------------------
    # Database injection (called from main startup)
    # ------------------------------------------------------------------

    def set_database(self, db) -> None:
        """Inject the pymongo database object after startup."""
        self._db = db
        self._ensure_index()

    def _ensure_index(self) -> None:
        if self._db is None:
            return
        try:
            self._db[AUTHORITY_COLLECTION].create_index("email", unique=True)
        except Exception as exc:
            logger.warning("Could not create authority_accounts index: %s", exc)

    # ------------------------------------------------------------------
    # Password helpers
    # ------------------------------------------------------------------

    def _hash_password(self, password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
        ).hex()

    # ------------------------------------------------------------------
    # Existence check (used by frontend /api/auth/authority-status)
    # ------------------------------------------------------------------

    def authority_exists(self) -> bool:
        """Return True when at least one authority account is registered."""
        # Check cache first
        if self._cache:
            return True
        if self._db is None:
            return False
        try:
            doc = self._db[AUTHORITY_COLLECTION].find_one({}, {"_id": 1})
            return doc is not None
        except Exception as exc:
            logger.warning("authority_exists DB query failed: %s", exc)
            return False

    def get_authority_count(self) -> int:
        if self._cache:
            return len(self._cache)
        if self._db is None:
            return 0
        try:
            return self._db[AUTHORITY_COLLECTION].count_documents({})
        except Exception as exc:
            logger.warning("get_authority_count DB query failed: %s", exc)
            return 0

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_authority(
        self,
        name: str,
        email: str,
        password: str,
    ) -> AuthorityRecord:
        """Create a new authority account.  Raises 409 on duplicate email.

        Security guarantees:
        - role is always forced to 'authority' here, never taken from input.
        - password is hashed with PBKDF2-SHA256 + random salt.
        - plaintext password is never stored or logged.
        """
        clean_email = email.strip().lower()

        # Duplicate guard — check cache
        if clean_email in self._cache:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An Authority account with this email already exists.",
            )

        # Duplicate guard — check DB
        if self._db is not None:
            try:
                existing = self._db[AUTHORITY_COLLECTION].find_one({"email": clean_email})
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="An Authority account with this email already exists.",
                    )
            except HTTPException:
                raise
            except Exception as exc:
                logger.error("DB lookup before authority registration failed: %s", exc)

        salt = secrets.token_hex(16)
        pwd_hash = self._hash_password(password, salt)
        authority_id = f"auth-{secrets.token_hex(6)}"

        record = AuthorityRecord(
            id=authority_id,
            name=name.strip(),
            email=clean_email,
            password_hash=pwd_hash,
            salt=salt,
        )

        # Persist to DB
        if self._db is not None:
            try:
                self._db[AUTHORITY_COLLECTION].insert_one(record.to_dict())
                logger.info("Authority account created in DB: %s (id=%s)", clean_email, authority_id)
            except Exception as exc:
                logger.error("Failed to persist authority account to DB: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Failed to save authority account to database. Please try again.",
                )

        # Cache in memory
        self._cache[clean_email] = record
        return record

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(self, email: str, password: str) -> AuthorityRecord:
        """Verify email + password against the DB-backed authority account.

        Returns the AuthorityRecord on success.
        Raises HTTP 401 on any mismatch (deliberately opaque error message).
        """
        clean_email = email.strip().lower()

        record = self._get_by_email(clean_email)
        if record is None:
            # Constant-time-ish: hash anyway to avoid timing oracle
            dummy_salt = secrets.token_hex(16)
            self._hash_password(password, dummy_salt)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authority credentials.",
            )

        candidate_hash = self._hash_password(password, record.salt)
        if not hmac.compare_digest(candidate_hash, record.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authority credentials.",
            )

        return record

    # ------------------------------------------------------------------
    # Lookups
    # ------------------------------------------------------------------

    def _get_by_email(self, clean_email: str) -> Optional[AuthorityRecord]:
        """Try cache first, then DB."""
        if clean_email in self._cache:
            return self._cache[clean_email]

        if self._db is None:
            return None

        try:
            doc = self._db[AUTHORITY_COLLECTION].find_one({"email": clean_email})
            if doc:
                record = AuthorityRecord.from_dict(doc)
                self._cache[clean_email] = record
                return record
        except Exception as exc:
            logger.warning("DB lookup for authority email failed: %s", exc)

        return None

    def get_by_id(self, authority_id: str) -> Optional[AuthorityRecord]:
        """Lookup by authority account id (used by JWT resolve in auth_deps)."""
        # Search cache
        for record in self._cache.values():
            if record.id == authority_id:
                return record

        if self._db is None:
            return None

        try:
            doc = self._db[AUTHORITY_COLLECTION].find_one({"_id": authority_id})
            if doc:
                record = AuthorityRecord.from_dict(doc)
                self._cache[record.email] = record
                return record
        except Exception as exc:
            logger.warning("DB lookup for authority id failed: %s", exc)

        return None


# Module-level singleton
authority_store = AuthorityStore()
