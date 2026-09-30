"""Incident Management API — Phase 3.

Endpoints:
    GET    /api/incidents            — list with optional filters
    GET    /api/incidents/{id}       — single incident
    POST   /api/incidents            — create incident
    PUT    /api/incidents/{id}       — partial update
    DELETE /api/incidents/{id}       — remove incident

No database, no AI, no optimization, no WebSocket.
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from models.errors import CrisisError
from schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
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
        "Returns all active incidents. Supports optional query filters: "
        "`severity`, `status`, `type`, and full-text `search`."
    ),
    status_code=status.HTTP_200_OK,
)
async def list_incidents(
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity level: critical, high, medium, low",
        examples={"critical": {"value": "critical"}},
    ),
    status: Optional[str] = Query(
        default=None,
        description="Filter by workflow status: reported, assessed, dispatched, in_progress, resolved, closed",
        examples={"in_progress": {"value": "in_progress"}},
    ),
    type: Optional[str] = Query(
        default=None,
        description="Filter by incident type (partial, case-insensitive match)",
        examples={"fire": {"value": "fire"}},
    ),
    search: Optional[str] = Query(
        default=None,
        description="Full-text search across type, description, and location (case-insensitive)",
        examples={"koramangala": {"value": "koramangala"}},
    ),
) -> List[IncidentResponse]:
    """Return all incidents, optionally filtered."""
    return incident_store.get_all(
        severity=severity,
        status=status,
        incident_type=type,
        search=search,
    )


# ---------------------------------------------------------------------------
# GET /api/incidents/{incident_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Get single incident",
    description="Returns a single incident by its unique identifier.",
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Incident not found"}},
)
async def get_incident(incident_id: str) -> IncidentResponse:
    """Fetch one incident by ID."""
    inc = incident_store.get_by_id(incident_id)
    if inc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
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
        "Creates a new emergency incident. "
        "All required fields are validated using the Phase 2 Pydantic schema. "
        "An audit event is automatically recorded on creation."
    ),
    status_code=status.HTTP_201_CREATED,
    responses={422: {"description": "Validation error"}},
)
async def create_incident(payload: IncidentCreate) -> IncidentResponse:
    """Create and store a new incident."""
    return incident_store.create(payload, actor="operator")


# ---------------------------------------------------------------------------
# PUT /api/incidents/{incident_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Update incident",
    description=(
        "Partially updates an existing incident. "
        "Supports: severity, urgency, status, location, required_resources, description. "
        "Only supplied fields are changed; omitted fields are preserved. "
        "An audit event is recorded for every update."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Incident not found"},
        422: {"description": "Validation error"},
    },
)
async def update_incident(
    incident_id: str, payload: IncidentUpdate
) -> IncidentResponse:
    """Partially update an incident by ID."""
    updated = incident_store.update(incident_id, payload, actor="operator")
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
    description=(
        "Permanently removes an incident from the active incident list. "
        "An audit event is recorded for the deletion."
    ),
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Incident not found"}},
)
async def delete_incident(incident_id: str) -> dict:
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
