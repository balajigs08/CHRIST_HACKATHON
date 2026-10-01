"""Authentication and OTP Verification Pydantic Schemas."""
import re
from datetime import datetime
from typing import Optional
from enum import Enum
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRole(str, Enum):
    USER = "user"
    AUTHORITY = "authority"


EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


class UserRegisterRequest(BaseModel):
    """User registration input."""
    name: str = Field(..., min_length=2, max_length=100, description="Full name of user")
    email: str = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="Account password (min 6 characters)")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("Invalid email format.")
        return clean


class UserRegisterResponse(BaseModel):
    """Safe response after registration (never contains OTP)."""
    message: str = "Registration successful. A 6-digit verification code has been sent to your email."
    email: str
    role: str = "user"
    is_verified: bool = False
    cooldown_seconds: int = 60


class OTPVerifyRequest(BaseModel):
    """OTP verification input."""
    email: str = Field(..., description="Registered email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("otp")
    @classmethod
    def validate_otp_format(cls, v: str) -> str:
        clean = v.strip()
        if not clean.isdigit() or len(clean) != 6:
            raise ValueError("OTP must be a 6-digit numeric code.")
        return clean


class OTPVerifyResponse(BaseModel):
    """Response after OTP verification."""
    message: str = "Email verified successfully."
    email: str
    is_verified: bool = True
    access_token: Optional[str] = None
    token_type: str = "bearer"
    role: str = "user"
    user: Optional[dict] = None


class OTPResendRequest(BaseModel):
    """Request to resend OTP."""
    email: str = Field(..., description="Registered email address")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class OTPResendResponse(BaseModel):
    """Safe response after resending OTP."""
    message: str = "A new verification code has been sent to your email."
    cooldown_seconds: int = 60


class UserLoginRequest(BaseModel):
    """User login request."""
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class AuthorityLoginRequest(BaseModel):
    """Authority operator login request."""
    email: str = Field(..., description="Regional emergency authority email")
    password: str = Field(..., min_length=1, description="Authority secret password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class AuthorityRegisterRequest(BaseModel):
    """Authority registration — only reachable from the dedicated authority endpoint."""
    name: str = Field(..., min_length=2, max_length=100, description="Official authority name")
    email: str = Field(..., description="Official authority email address")
    password: str = Field(..., min_length=8, max_length=128, description="Authority password (min 8 characters)")
    confirm_password: str = Field(..., min_length=1, description="Must match password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        clean = v.strip().lower()
        import re
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", clean):
            raise ValueError("Invalid email format.")
        return clean

    @field_validator("confirm_password")
    @classmethod
    def passwords_must_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class AuthorityRegisterResponse(BaseModel):
    """Safe response after authority registration."""
    message: str = "Authority account created successfully."
    id: str
    name: str
    email: str
    role: str = "authority"


class AuthorityStatusResponse(BaseModel):
    """Frontend status check — does an authority account exist?"""
    authority_exists: bool
    count: int = 0



class TokenResponse(BaseModel):
    """JWT Access Token response."""
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    email: str
    name: str


class UserProfileResponse(BaseModel):
    """Authenticated user profile."""
    id: str
    name: str
    email: str
    role: str
    is_verified: bool
    created_at: datetime
