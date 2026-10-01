"""FastAPI security dependencies for authentication and RBAC."""
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from schemas.auth import UserRole
from services.auth_service import UserRecord, auth_service


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> UserRecord:
    """Dependency extracting and validating JWT bearer token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme. Use 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = parts[1]
    payload = auth_service.decode_jwt_token(token)
    user_id = payload.get("sub")
    user = auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_current_user(
    authorization: Optional[str] = Header(default=None),
) -> Optional[UserRecord]:
    """Optional authentication dependency for mixed public/authenticated routes."""
    if not authorization:
        return None
    try:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            payload = auth_service.decode_jwt_token(parts[1])
            return auth_service.get_user_by_id(payload.get("sub"))
    except Exception:
        pass
    return None


async def require_verified_user(user: UserRecord = Depends(get_current_user)) -> UserRecord:
    """Ensure authenticated caller is a verified civilian USER."""
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified. Please complete OTP verification.",
        )
    if user.role != UserRole.USER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This operation is reserved for citizen USER accounts.",
        )
    return user


async def require_authority(user: UserRecord = Depends(get_current_user)) -> UserRecord:
    """Ensure authenticated caller holds the AUTHORITY role."""
    if user.role != UserRole.AUTHORITY.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Authority credentials required.",
        )
    return user


async def check_authority_or_open(
    current_user: Optional[UserRecord] = Depends(get_optional_current_user),
) -> Optional[UserRecord]:
    """Blocks citizen USER accounts with 403 Forbidden while permitting authorities and internal calls."""
    if current_user and current_user.role == UserRole.USER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Citizen USER accounts are not permitted to access authority management endpoints.",
        )
    return current_user

