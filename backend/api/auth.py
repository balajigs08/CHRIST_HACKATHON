"""Authentication and OTP Verification Endpoints."""
import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from api.auth_deps import get_current_user
from schemas.auth import (
    AuthorityLoginRequest,
    AuthorityRegisterRequest,
    AuthorityRegisterResponse,
    AuthorityStatusResponse,
    OTPResendRequest,
    OTPResendResponse,
    OTPVerifyRequest,
    OTPVerifyResponse,
    TokenResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
    UserRegisterResponse,
)
from services.auth_service import UserRecord, auth_service
from services.authority_store import authority_store
from services.email_service import email_service

logger = logging.getLogger("crisis-command.api.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserRegisterResponse,
    status_code=status.HTTP_200_OK,
    summary="User Registration",
    description="Register a new citizen account and dispatch a 6-digit email verification OTP.",
)
async def register(payload: UserRegisterRequest) -> UserRegisterResponse:
    user, cooldown = auth_service.register_user(
        name=payload.name,
        email=payload.email,
        password=payload.password,
    )
    return UserRegisterResponse(
        message="Registration successful. A 6-digit verification code has been sent to your email.",
        email=user.email,
        is_verified=user.is_verified,
        cooldown_seconds=cooldown,
    )


@router.post(
    "/verify-otp",
    response_model=OTPVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Email OTP",
    description="Validate the 6-digit OTP, verify email, and obtain an initial access token.",
)
async def verify_otp(payload: OTPVerifyRequest) -> OTPVerifyResponse:
    user, token = auth_service.verify_otp(
        email=payload.email,
        candidate_otp=payload.otp,
    )
    return OTPVerifyResponse(
        message="Email verified successfully. You can now access your dashboard.",
        email=user.email,
        is_verified=True,
        access_token=token,
        token_type="bearer",
        role=user.role,
        user={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_verified": user.is_verified,
        },
    )


@router.post(
    "/resend-otp",
    response_model=OTPResendResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend Verification OTP",
    description="Invalidate previous OTP and dispatch a fresh 6-digit verification code subject to cooldown.",
)
async def resend_otp(payload: OTPResendRequest) -> OTPResendResponse:
    cooldown = auth_service.resend_otp(payload.email)
    return OTPResendResponse(
        message="A new verification code has been sent to your email.",
        cooldown_seconds=cooldown,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Citizen User Login",
    description="Authenticate verified citizen user accounts and obtain JWT access token.",
)
async def login(payload: UserLoginRequest) -> TokenResponse:
    user, token = auth_service.login_user(
        email=payload.email,
        password=payload.password,
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        email=user.email,
        name=user.name,
    )


@router.post(
    "/authority-login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Regional Authority Login",
    description="Authenticate emergency response authority using database-backed credentials.",
)
async def authority_login(payload: AuthorityLoginRequest) -> TokenResponse:
    user, token = auth_service.login_authority(
        email=payload.email,
        password=payload.password,
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        email=user.email,
        name=user.name,
    )


@router.get(
    "/authority-status",
    response_model=AuthorityStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Authority Account Status",
    description="Check whether an authority account is registered. Used by the frontend to decide registration vs login flow.",
)
async def authority_status() -> AuthorityStatusResponse:
    return AuthorityStatusResponse(
        authority_exists=authority_store.authority_exists(),
        count=authority_store.get_authority_count(),
    )


@router.post(
    "/authority-register",
    response_model=AuthorityRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Authority Account Registration",
    description=(
        "Register a new authority account. Only allowed when NO authority account exists. "
        "Subsequent registrations are rejected (single-authority model). "
        "Role is always forced to 'authority' regardless of any frontend input."
    ),
)
async def authority_register(payload: AuthorityRegisterRequest) -> AuthorityRegisterResponse:
    # Block if an authority already exists — single-authority model
    if authority_store.authority_exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An Authority account already exists. Use the Authority Login instead.",
        )

    record = authority_store.register_authority(
        name=payload.name,
        email=payload.email,
        password=payload.password,
    )
    logger.info("Authority account registered: %s (id=%s)", record.email, record.id)
    return AuthorityRegisterResponse(
        message="Authority account created successfully. Please log in.",
        id=record.id,
        name=record.name,
        email=record.email,
        role=record.role,
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current Profile",
    description="Retrieve profile and role information for the authenticated user.",
)
async def get_my_profile(current_user: UserRecord = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
    )


@router.get(
    "/smtp-diagnostics",
    status_code=status.HTTP_200_OK,
    summary="SMTP Diagnostics Status",
    description="Inspect safe SMTP configuration status without exposing credentials or OTPs.",
)
async def get_smtp_diagnostics() -> Dict[str, Any]:
    return email_service.get_diagnostics()


@router.post(
    "/test-smtp",
    status_code=status.HTTP_200_OK,
    summary="Test SMTP Server Connection",
    description="Safely test live connection and authentication with the configured SMTP server.",
)
async def test_smtp() -> Dict[str, Any]:
    success, message = email_service.test_connection()
    if not success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"SMTP Connection Test Failed: {message}",
        )
    return {
        "status": "success",
        "message": message,
        "diagnostics": email_service.get_diagnostics(),
    }
