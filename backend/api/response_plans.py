"""Response Plan API — Phase 6.

Endpoints:
    GET  /api/response-plans                     — list all plans
    GET  /api/response-plans/{plan_id}           — single plan
    POST /api/response-plans                     — create plan
    PUT  /api/response-plans/{plan_id}           — partial update
    GET  /api/response-plans/{plan_id}/summary   — aggregated summary

No database, no AI, no optimization, no WebSocket.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.auth_deps import check_authority_or_open
from schemas.plan import ResponsePlanCreate, ResponsePlanResponse, ResponsePlanUpdate
from services.incident_store import incident_store
from services.resource_store import resource_store
from services.response_plan_store import response_plan_store

router = APIRouter(
    prefix="/response-plans",
    tags=["Response Plans"],
    dependencies=[Depends(check_authority_or_open)],
)


# ---------------------------------------------------------------------------
# GET /api/response-plans
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[ResponsePlanResponse],
    summary="List response plans",
    description="Returns all response plans, newest first. Optionally filter by status.",
    status_code=status.HTTP_200_OK,
)
async def list_plans(
    status: Optional[str] = Query(
        default=None,
        description="Filter by plan status: pending, active, updated, completed, requires_attention",
    ),
) -> List[ResponsePlanResponse]:
    return response_plan_store.get_all(status=status)


# ---------------------------------------------------------------------------
# GET /api/response-plans/{plan_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{plan_id}",
    response_model=ResponsePlanResponse,
    summary="Get single response plan",
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Plan not found"}},
)
async def get_plan(plan_id: str) -> ResponsePlanResponse:
    plan = response_plan_store.get_by_id(plan_id)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response plan '{plan_id}' not found.",
        )
    return plan


# ---------------------------------------------------------------------------
# POST /api/response-plans
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=ResponsePlanResponse,
    summary="Create response plan",
    description=(
        "Creates a new emergency response plan. "
        "All referenced incident IDs and resource IDs are validated to exist. "
        "ETAs are computed automatically for each resource assignment using "
        "the Haversine-based location service. "
        "An audit event is recorded."
    ),
    status_code=status.HTTP_201_CREATED,
    responses={
        422: {"description": "Validation error or referenced entity not found"},
    },
)
async def create_plan(payload: ResponsePlanCreate) -> ResponsePlanResponse:
    return response_plan_store.create(payload, actor="operator")


# ---------------------------------------------------------------------------
# PUT /api/response-plans/{plan_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{plan_id}",
    response_model=ResponsePlanResponse,
    summary="Update response plan",
    description=(
        "Partially updates a response plan. "
        "Supports: status, incident_ids, resource_assignments. "
        "All new incident/resource references are validated. "
        "ETAs are recomputed when assignments change. "
        "An audit event is recorded."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Plan not found"},
        422: {"description": "Validation error or referenced entity not found"},
    },
)
async def update_plan(plan_id: str, payload: ResponsePlanUpdate) -> ResponsePlanResponse:
    return response_plan_store.update(plan_id, payload, actor="operator")


# ---------------------------------------------------------------------------
# GET /api/response-plans/{plan_id}/summary
# ---------------------------------------------------------------------------
@router.get(
    "/{plan_id}/summary",
    summary="Get plan summary",
    description=(
        "Returns an aggregated summary of the response plan including: "
        "total incidents, assigned/unassigned breakdown, "
        "resource count, estimated response times per incident, and plan status."
    ),
    status_code=status.HTTP_200_OK,
    responses={404: {"description": "Plan not found"}},
)
async def get_plan_summary(plan_id: str) -> Dict[str, Any]:
    plan = response_plan_store.get_by_id(plan_id)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response plan '{plan_id}' not found.",
        )

    assigned_incident_ids = {asgn.incident_id for asgn in plan.resource_assignments}
    unassigned_ids = [iid for iid in plan.incident_ids if iid not in assigned_incident_ids]

    # Build per-incident breakdown
    incident_breakdown = []
    for iid in plan.incident_ids:
        inc = incident_store.get_by_id(iid)
        resources_for_inc = [
            {
                "resource_id": a.resource_id,
                "role": a.role,
                "eta_minutes": a.eta_minutes,
                "distance_km": a.distance_km,
                "assignment_status": a.assignment_status,
            }
            for a in plan.resource_assignments if a.incident_id == iid
        ]
        incident_breakdown.append({
            "incident_id": iid,
            "type": inc.type if inc else "unknown",
            "severity": inc.severity.value if inc else "unknown",
            "location": inc.location if inc else "unknown",
            "status": inc.status.value if inc else "unknown",
            "assigned_resources": resources_for_inc,
            "resource_count": len(resources_for_inc),
            "estimated_response_time_minutes": plan.estimated_response_times.get(iid),
        })

    # Resource utilisation
    unique_resources = {a.resource_id for a in plan.resource_assignments}

    return {
        "plan_id": plan_id,
        "plan_status": plan.status.value,
        "created_at": plan.created_at.isoformat(),
        "updated_at": plan.updated_at.isoformat(),
        "total_incidents": len(plan.incident_ids),
        "total_assigned_resources": len(unique_resources),
        "total_assignments": len(plan.resource_assignments),
        "unassigned_incidents": unassigned_ids,
        "unassigned_count": len(unassigned_ids),
        "estimated_response_times": plan.estimated_response_times,
        "average_eta_minutes": (
            round(sum(plan.estimated_response_times.values()) / len(plan.estimated_response_times), 1)
            if plan.estimated_response_times else None
        ),
        "incidents": incident_breakdown,
    }
