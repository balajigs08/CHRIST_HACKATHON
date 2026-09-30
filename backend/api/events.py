"""Events & Audit API — Phase 7.

Endpoints:
    GET  /api/events                        — paginated list with filters
    GET  /api/events/{event_id}             — single event
    POST /api/events                        — manually record an event

    GET  /api/incidents/{incident_id}/events  — all events for an incident
    GET  /api/resources/{resource_id}/events  — all events for a resource

No database, no WebSocket, no AI.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from schemas.event import EventCreate, EventResponse
from services.event_service import event_service

router = APIRouter(tags=["Events & Audit"])


# ---------------------------------------------------------------------------
# Paginated response schema (inline — keeps schema file clean)
# ---------------------------------------------------------------------------
from pydantic import BaseModel


class PaginatedEventsResponse(BaseModel):
    items: List[EventResponse]
    total: int
    page: int
    limit: int
    pages: int


# ---------------------------------------------------------------------------
# GET /api/events
# ---------------------------------------------------------------------------
@router.get(
    "/events/",
    response_model=PaginatedEventsResponse,
    summary="List audit events",
    description=(
        "Returns all audit events, newest first. "
        "Supports filtering by event_type, incident_id, resource_id, actor, and free-text search. "
        "Pagination via `page` and `limit` parameters."
    ),
    status_code=status.HTTP_200_OK,
)
async def list_events(
    event_type: Optional[str] = Query(
        default=None,
        description="Filter by event type (e.g. incident_reported, resource_assigned, plan_created)",
    ),
    incident_id: Optional[str] = Query(default=None, description="Filter by associated incident ID"),
    resource_id: Optional[str] = Query(default=None, description="Filter by associated resource ID"),
    actor: Optional[str] = Query(default=None, description="Filter by actor (system, operator, etc.)"),
    search: Optional[str] = Query(
        default=None, description="Full-text search across description, event_type, IDs, and actor"
    ),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=50, ge=1, le=200, description="Items per page (max 200)"),
) -> PaginatedEventsResponse:
    items, total = event_service.list_events(
        event_type=event_type,
        incident_id=incident_id,
        resource_id=resource_id,
        actor=actor,
        search=search,
        page=page,
        limit=limit,
    )
    pages = max(1, (total + limit - 1) // limit)
    return PaginatedEventsResponse(items=items, total=total, page=page, limit=limit, pages=pages)


# ---------------------------------------------------------------------------
# GET /api/events/{event_id}
# ---------------------------------------------------------------------------
@router.get(
    "/events/{event_id}",
    response_model=EventResponse,
    summary="Get single audit event",
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Event not found"}},
)
async def get_event(event_id: str) -> EventResponse:
    evt = event_service.get_by_id(event_id)
    if evt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found.",
        )
    return evt


# ---------------------------------------------------------------------------
# POST /api/events
# ---------------------------------------------------------------------------
@router.post(
    "/events/",
    response_model=EventResponse,
    summary="Record an audit event",
    description=(
        "Manually records an audit event. "
        "Useful for external actor notifications or custom workflow steps. "
        "event_type must be a valid EventType enum value."
    ),
    status_code=status.HTTP_201_CREATED,
    responses={422: {"description": "Validation error"}},
)
async def create_event(payload: EventCreate) -> EventResponse:
    evt = event_service.record_from_create(payload)
    from services.broadcaster import broadcast_alert_created
    broadcast_alert_created(evt)
    return evt


# ---------------------------------------------------------------------------
# GET /api/incidents/{incident_id}/events
# ---------------------------------------------------------------------------
@router.get(
    "/incidents/{incident_id}/events",
    response_model=List[EventResponse],
    summary="Get events for a specific incident",
    description=(
        "Returns all audit events associated with a given incident, newest first. "
        "Returns an empty list (not 404) if no events have been recorded for this incident."
    ),
    status_code=status.HTTP_200_OK,
)
async def get_incident_events(
    incident_id: str,
    limit: int = Query(default=100, ge=1, le=500, description="Maximum events to return"),
) -> List[EventResponse]:
    return event_service.list_by_incident(incident_id, limit=limit)


# ---------------------------------------------------------------------------
# GET /api/resources/{resource_id}/events
# ---------------------------------------------------------------------------
@router.get(
    "/resources/{resource_id}/events",
    response_model=List[EventResponse],
    summary="Get events for a specific resource",
    description=(
        "Returns all audit events associated with a given resource, newest first. "
        "Returns an empty list (not 404) if no events have been recorded for this resource."
    ),
    status_code=status.HTTP_200_OK,
)
async def get_resource_events(
    resource_id: str,
    limit: int = Query(default=100, ge=1, le=500, description="Maximum events to return"),
) -> List[EventResponse]:
    return event_service.list_by_resource(resource_id, limit=limit)
