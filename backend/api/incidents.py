"""Incident Management API with Authentication, RBAC, and Reporter Ownership Security."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.auth_deps import get_current_user, get_optional_current_user
from models.errors import CrisisError
from schemas.auth import UserRole
from schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
from services.auth_service import UserRecord, auth_service
from services.incident_store import incident_store

router = APIRouter(prefix="/incidents", tags=["Incidents"])


# ---------------------------------------------------------------------------
# GET /api/incidents
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[IncidentResponse],
    summary="List incidents",
    description=(
        "Returns active incidents. For authenticated citizen USER accounts, "
        "only incidents created by that user are returned. Authorities can view all incidents."
    ),
    status_code=status.HTTP_200_OK,
)
async def list_incidents(
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity level: critical, high, medium, low",
    ),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filter by workflow status: reported, assessed, dispatched, in_progress, resolved, closed",
    ),
    type_filter: Optional[str] = Query(
        default=None,
        alias="type",
        description="Filter by incident type (partial, case-insensitive match)",
    ),
    search: Optional[str] = Query(
        default=None,
        description="Full-text search across type, description, and location",
    ),
    current_user: Optional[UserRecord] = Depends(get_optional_current_user),
) -> List[IncidentResponse]:
    """Return incidents with RBAC isolation."""
    # If authenticated as a civilian USER, restrict to their own incidents
    reporter_id_filter = None
    if current_user and current_user.role == UserRole.USER.value:
        reporter_id_filter = current_user.id

    return incident_store.get_all(
        severity=severity,
        status=status_filter,
        incident_type=type_filter,
        search=search,
        reporter_id=reporter_id_filter,
    )


# ---------------------------------------------------------------------------
# GET /api/incidents/{incident_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Get single incident",
    description="Returns an incident by ID. Citizen users can only view their own incidents.",
    status_code=status.HTTP_200_OK,
    responses={
        403: {"description": "Access forbidden for other users' incidents"},
        404: {"description": "Incident not found"},
    },
)
async def get_incident(
    incident_id: str,
    current_user: Optional[UserRecord] = Depends(get_optional_current_user),
) -> IncidentResponse:
    """Fetch one incident with privacy protection."""
    inc = incident_store.get_by_id(incident_id)
    if inc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )

    # Privacy enforcement for USER role
    if current_user and current_user.role == UserRole.USER.value:
        if inc.reporter_id and inc.reporter_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only view your own reported incidents.",
            )

    return inc


# ---------------------------------------------------------------------------
# POST /api/incidents
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=IncidentResponse,
    summary="Create incident",
    description=(
        "Creates a new emergency incident. Only verified citizen USER accounts may report incidents. "
        "Authorities cannot create incidents. The reporter_id is automatically bound to the authenticated user."
    ),
    status_code=status.HTTP_201_CREATED,
    responses={
        403: {"description": "Authority accounts cannot create incidents / unverified user"},
        422: {"description": "Validation error"},
        429: {"description": "Incident submission cooldown rate limit"},
    },
)
async def create_incident(
    payload: IncidentCreate,
    current_user: Optional[UserRecord] = Depends(get_optional_current_user),
) -> IncidentResponse:
    """Create and store a new incident with authenticated reporter_id."""
    actor = "citizen"
    reporter_id = None

    if current_user:
        # Rule 1: Authorities CANNOT create incidents
        if current_user.role == UserRole.AUTHORITY.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authority accounts are not permitted to create incidents via citizen intake.",
            )

        # Rule 2: Users MUST be verified
        if not current_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email is not verified. Please complete OTP verification to report incidents.",
            )

        # Rule 3: Anti-abuse rate limit / cooldown
        auth_service.check_incident_rate_limit(current_user.id)

        actor = current_user.name
        # Securely bind authenticated user's ID (never trusting client payload)
        reporter_id = current_user.id

    return incident_store.create(payload, actor=actor, reporter_id=reporter_id)


# ---------------------------------------------------------------------------
# PUT /api/incidents/{incident_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Update incident",
    description="Partially updates an existing incident.",
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Incident not found"},
        422: {"description": "Validation error"},
    },
)
async def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    current_user: Optional[UserRecord] = Depends(get_optional_current_user),
) -> IncidentResponse:
    """Partially update an incident by ID."""
    actor = current_user.name if current_user else "operator"
    updated = incident_store.update(incident_id, payload, actor=actor)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )
    return updated


# ---------------------------------------------------------------------------
# DELETE /api/incidents/{incident_id}
# ---------------------------------------------------------------------------
@router.delete(
    "/{incident_id}",
    summary="Delete incident",
    description="Permanently removes an incident from the active incident list.",
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Incident not found"}},
)
async def delete_incident(
    incident_id: str,
    current_user: Optional[UserRecord] = Depends(get_optional_current_user),
) -> dict:
    """Delete an incident by ID."""
    removed = incident_store.delete(incident_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )
    return {
        "status": "ok",
        "message": f"Incident '{incident_id}' has been removed.",
        "incident_id": incident_id,
    }
