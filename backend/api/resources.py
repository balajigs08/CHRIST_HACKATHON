"""Resource Management API — Phase 4.

Endpoints:
    GET    /api/resources            — list with optional filters
    GET    /api/resources/{id}       — single resource
    POST   /api/resources            — create resource
    PUT    /api/resources/{id}       — partial update (with assignment rules)
    DELETE /api/resources/{id}       — decommission resource

No database, no AI, no optimization, no WebSocket.
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from schemas.resource import ResourceCreate, ResourceResponse, ResourceUpdate
from services.resource_store import resource_store

router = APIRouter(prefix="/resources", tags=["Resources"])


# ---------------------------------------------------------------------------
# GET /api/resources
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[ResourceResponse],
    summary="List resources",
    description=(
        "Returns all emergency resources. "
        "Supports optional query filters: `type`, `status`, `availability`, and `search`."
    ),
    status_code=status.HTTP_200_OK,
)
async def list_resources(
    type: Optional[str] = Query(
        default=None,
        description=(
            "Filter by resource type: ambulance, fire_team, rescue_team, "
            "medical_unit, shelter, police"
        ),
    ),
    status: Optional[str] = Query(
        default=None,
        description="Filter by status: available, assigned, dispatched, on_scene, unavailable, maintenance",
    ),
    availability: Optional[bool] = Query(
        default=None,
        description="Filter by availability flag (true = ready to deploy)",
    ),
    search: Optional[str] = Query(
        default=None,
        description="Case-insensitive search across resource ID, type, and location",
    ),
) -> List[ResourceResponse]:
    """Return all resources, optionally filtered."""
    return resource_store.get_all(
        resource_type=type,
        status=status,
        availability=availability,
        search=search,
    )


# ---------------------------------------------------------------------------
# GET /api/resources/{resource_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{resource_id}",
    response_model=ResourceResponse,
    summary="Get single resource",
    description="Returns a single resource by its unique identifier.",
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Resource not found"}},
)
async def get_resource(resource_id: str) -> ResourceResponse:
    """Fetch one resource by ID."""
    res = resource_store.get_by_id(resource_id)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{resource_id}' not found.",
        )
    return res


# ---------------------------------------------------------------------------
# POST /api/resources
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=ResourceResponse,
    summary="Create resource",
    description=(
        "Registers a new emergency resource. "
        "All fields are validated using the Phase 2 Pydantic schema. "
        "An audit event is recorded on creation."
    ),
    status_code=status.HTTP_201_CREATED,
    responses={422: {"description": "Validation error"}},
)
async def create_resource(payload: ResourceCreate) -> ResourceResponse:
    """Register a new resource."""
    return resource_store.create(payload, actor="operator")


# ---------------------------------------------------------------------------
# PUT /api/resources/{resource_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{resource_id}",
    response_model=ResourceResponse,
    summary="Update resource",
    description=(
        "Partially updates an existing resource. "
        "Supports: location, latitude, longitude, status, availability, assigned_incident_id. "
        "Business rules enforced:\n"
        "- A resource with status `unavailable` or `maintenance` cannot be assigned to an incident.\n"
        "- A resource already assigned to one incident cannot be simultaneously assigned to another "
        "without first clearing the current assignment.\n"
        "An audit event is recorded for every state change."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Resource not found"},
        409: {"description": "Assignment conflict"},
        422: {"description": "Validation error"},
    },
)
async def update_resource(resource_id: str, payload: ResourceUpdate) -> ResourceResponse:
    """Partially update a resource (assignment rules enforced)."""
    # resource_store.update raises HTTPException on rule violations or 404
    return resource_store.update(resource_id, payload, actor="operator")


# ---------------------------------------------------------------------------
# DELETE /api/resources/{resource_id}
# ---------------------------------------------------------------------------
@router.delete(
    "/{resource_id}",
    summary="Delete resource",
    description=(
        "Decommissions and removes a resource from the active fleet. "
        "An audit event is recorded."
    ),
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Resource not found"}},
)
async def delete_resource(resource_id: str) -> dict:
    """Remove a resource by ID."""
    removed = resource_store.delete(resource_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{resource_id}' not found.",
        )
    return {
        "status": "ok",
        "message": f"Resource '{resource_id}' has been decommissioned.",
        "resource_id": resource_id,
    }
