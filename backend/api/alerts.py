"""Alerts API — Phase 9.

Endpoints:
    GET  /api/alerts                        — list with filters
    GET  /api/alerts/{alert_id}             — single alert
    POST /api/alerts                        — create alert
    PUT  /api/alerts/{alert_id}             — update alert

No database, no AI, no optimization.
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from schemas.alert import AlertCreate, AlertResponse, AlertUpdate
from services.alert_store import alert_store

router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ---------------------------------------------------------------------------
# GET /api/alerts
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[AlertResponse],
    summary="List emergency alerts",
    description=(
        "Returns all active and historical emergency alerts. "
        "Supports filtering by severity, status, requires_human_attention, and full-text search."
    ),
    status_code=status.HTTP_200_OK,
)
async def list_alerts(
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity: critical, high, medium, low, info",
    ),
    status: Optional[str] = Query(
        default=None,
        description="Filter by alert status: active, acknowledged, resolved",
    ),
    requires_human_attention: Optional[bool] = Query(
        default=None,
        description="Filter by requires_human_attention flag (true/false)",
    ),
    incident_id: Optional[str] = Query(
        default=None,
        description="Filter by associated incident ID",
    ),
    resource_id: Optional[str] = Query(
        default=None,
        description="Filter by associated resource ID",
    ),
    search: Optional[str] = Query(
        default=None,
        description="Free-text search across alert title, description, and entity IDs",
    ),
) -> List[AlertResponse]:
    return alert_store.get_all(
        severity=severity,
        status=status,
        requires_human_attention=requires_human_attention,
        incident_id=incident_id,
        resource_id=resource_id,
        search=search,
    )


# ---------------------------------------------------------------------------
# GET /api/alerts/{alert_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Get single alert",
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Alert not found"}},
)
async def get_alert(alert_id: str) -> AlertResponse:
    alt = alert_store.get_by_id(alert_id)
    if alt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )
    return alt


# ---------------------------------------------------------------------------
# POST /api/alerts
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=AlertResponse,
    summary="Create emergency alert",
    description="Registers a new emergency alert, creates an audit event, and broadcasts it in real time.",
    status_code=status.HTTP_201_CREATED,
    responses={422: {"description": "Validation error"}},
)
async def create_alert(payload: AlertCreate) -> AlertResponse:
    return alert_store.create(payload, actor="operator")


# ---------------------------------------------------------------------------
# PUT /api/alerts/{alert_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Update emergency alert",
    description=(
        "Partially updates an existing alert (e.g. status, severity, human attention required). "
        "Setting status to 'resolved' automatically stamps resolved_at."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Alert not found"},
        422: {"description": "Validation error"},
    },
)
async def update_alert(alert_id: str, payload: AlertUpdate) -> AlertResponse:
    updated = alert_store.update(alert_id, payload, actor="operator")
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )
    return updated
