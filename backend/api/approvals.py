"""Human Approvals API — Phase 9.

Endpoints:
    GET  /api/approvals                     — list with filters
    GET  /api/approvals/{request_id}        — single approval request
    POST /api/approvals                     — create approval request
    PUT  /api/approvals/{request_id}        — update / resolve (approve/reject)

No database, no AI, no optimization.
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from schemas.approval import (
    HumanApprovalRequestCreate,
    HumanApprovalRequestResponse,
    HumanApprovalRequestUpdate,
)
from services.approval_store import approval_store

router = APIRouter(prefix="/approvals", tags=["Human Approvals"])


# ---------------------------------------------------------------------------
# GET /api/approvals
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[HumanApprovalRequestResponse],
    summary="List human approval requests",
    description=(
        "Returns all human approval requests. "
        "Supports filtering by type, status, incident_id, resource_id, and search."
    ),
    status_code=status.HTTP_200_OK,
)
async def list_approvals(
    type: Optional[str] = Query(
        default=None,
        description="Filter by type: resource_reallocation, emergency_dispatch, response_plan_change, manual_override, shortage",
    ),
    status: Optional[str] = Query(
        default=None,
        description="Filter by status: pending, approved, rejected, superseded",
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
        description="Free-text search across description, reason, impact, and IDs",
    ),
) -> List[HumanApprovalRequestResponse]:
    return approval_store.get_all(
        type=type,
        status=status,
        incident_id=incident_id,
        resource_id=resource_id,
        search=search,
    )


# ---------------------------------------------------------------------------
# GET /api/approvals/{request_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{request_id}",
    response_model=HumanApprovalRequestResponse,
    summary="Get single human approval request",
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Approval request not found"}},
)
async def get_approval(request_id: str) -> HumanApprovalRequestResponse:
    req = approval_store.get_by_id(request_id)
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval request '{request_id}' not found.",
        )
    return req


# ---------------------------------------------------------------------------
# POST /api/approvals
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=HumanApprovalRequestResponse,
    summary="Create human approval request",
    description=(
        "Submits a new operational action requiring operator sign-off. "
        "Generates an audit event and broadcasts real-time WebSocket notification."
    ),
    status_code=status.HTTP_201_CREATED,
    responses={422: {"description": "Validation error"}},
)
async def create_approval(payload: HumanApprovalRequestCreate) -> HumanApprovalRequestResponse:
    return approval_store.create(payload, actor="operator")


# ---------------------------------------------------------------------------
# PUT /api/approvals/{request_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{request_id}",
    response_model=HumanApprovalRequestResponse,
    summary="Resolve or update human approval request",
    description=(
        "Updates an approval request or records a human decision (status='approved' or 'rejected'). "
        "Automatically stamps resolved_at and resolved_by, creates an audit event, and broadcasts the resolution."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Approval request not found"},
        422: {"description": "Validation error"},
    },
)
async def update_approval(
    request_id: str, payload: HumanApprovalRequestUpdate
) -> HumanApprovalRequestResponse:
    updated = approval_store.update(request_id, payload, actor="operator")
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval request '{request_id}' not found.",
        )
    return updated
