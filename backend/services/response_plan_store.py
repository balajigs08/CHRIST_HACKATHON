"""In-memory response plan store (Phase 6).

Handles CRUD for response plans, validates referenced incidents and resources,
computes ETAs via LocationService, and emits audit events.
No database, no AI, no optimization, no WebSocket.
"""
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status as http_status

from schemas.base import utc_now
from schemas.enums import EventType, PlanStatus
from schemas.plan import (
    ResourceAssignment,
    ResponsePlanCreate,
    ResponsePlanResponse,
    ResponsePlanUpdate,
)
from services.event_service import event_service
from services.incident_store import incident_store
from services.location_service import location_service
from services.resource_store import resource_store
from services.broadcaster import broadcast_plan_created, broadcast_plan_updated

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
_SEED_PLANS = [
    {
        "plan_id": "plan-seed-001",
        "status": "active",
        "incident_ids": ["inc-seed-001", "inc-seed-002"],
        "resource_assignments": [
            {
                "incident_id": "inc-seed-001",
                "resource_id": "RES-FIRE-01",
                "role": "Primary Fire Suppression",
                "assignment_status": "on_scene",
            },
            {
                "incident_id": "inc-seed-001",
                "resource_id": "RES-RESC-02",
                "role": "Search & Rescue",
                "assignment_status": "on_scene",
            },
            {
                "incident_id": "inc-seed-002",
                "resource_id": "RES-AMB-03",
                "role": "Emergency Medical",
                "assignment_status": "en_route",
            },
            {
                "incident_id": "inc-seed-002",
                "resource_id": "RES-POL-01",
                "role": "Traffic & Perimeter Control",
                "assignment_status": "on_scene",
            },
        ],
    },
    {
        "plan_id": "plan-seed-002",
        "status": "pending",
        "incident_ids": ["inc-seed-003"],
        "resource_assignments": [
            {
                "incident_id": "inc-seed-003",
                "resource_id": "RES-AMB-01",
                "role": "First Response Ambulance",
                "assignment_status": "assigned",
            },
            {
                "incident_id": "inc-seed-003",
                "resource_id": "RES-MED-01",
                "role": "Advanced Medical Support",
                "assignment_status": "assigned",
            },
        ],
    },
]


def _compute_eta(resource_id: str, incident_id: str) -> tuple[Optional[float], Optional[float]]:
    """Return (eta_minutes, distance_km) or (None, None) if data is unavailable."""
    res = resource_store.get_by_id(resource_id)
    inc = incident_store.get_by_id(incident_id)
    if res is None or inc is None:
        return None, None
    try:
        est = location_service.estimate(
            origin_lat=res.latitude,
            origin_lng=res.longitude,
            destination_lat=inc.latitude,
            destination_lng=inc.longitude,
        )
        return est.estimated_time_minutes, est.distance_km
    except Exception:
        return None, None


def _build_assignments(raw_list: list) -> List[ResourceAssignment]:
    """Build ResourceAssignment objects with ETA filled in."""
    assignments = []
    for raw in raw_list:
        if isinstance(raw, ResourceAssignment):
            d = raw.model_dump()
        else:
            d = dict(raw)
        rid = d.get("resource_id", "")
        iid = d.get("incident_id", "")
        # Always recompute if either value is missing or None
        if d.get("eta_minutes") is None or d.get("distance_km") is None:
            eta, dist = _compute_eta(rid, iid)
            if eta is not None:
                d["eta_minutes"] = eta
                d["distance_km"] = dist
        assignments.append(ResourceAssignment(**d))
    return assignments


def _compute_ert(assignments: List[ResourceAssignment]) -> Dict[str, float]:
    """Compute estimated response times: min eta across resources per incident."""
    ert: Dict[str, float] = {}
    for asgn in assignments:
        if asgn.eta_minutes is not None:
            iid = asgn.incident_id
            ert[iid] = min(ert.get(iid, float("inf")), asgn.eta_minutes)
    return {k: round(v, 1) for k, v in ert.items()}


class ResponsePlanStore:
    """In-memory store for emergency response plans."""

    def __init__(self) -> None:
        self._store: Dict[str, ResponsePlanResponse] = {}
        self._seed()

    def _seed(self) -> None:
        now = utc_now()
        for raw in _SEED_PLANS:
            assignments = _build_assignments(raw["resource_assignments"])
            ert = _compute_ert(assignments)
            plan = ResponsePlanResponse(
                id=raw["plan_id"],
                status=raw["status"],
                incident_ids=raw["incident_ids"],
                resource_assignments=assignments,
                estimated_response_times=ert,
                created_at=now,
                updated_at=now,
            )
            self._store[raw["plan_id"]] = plan

    # -----------------------------------------------------------------------
    # Validation helpers
    # -----------------------------------------------------------------------
    def _validate_incidents(self, ids: List[str]) -> None:
        for iid in ids:
            if incident_store.get_by_id(iid) is None:
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Incident '{iid}' does not exist.",
                )

    def _validate_resources(self, assignments: List[ResourceAssignment]) -> None:
        for asgn in assignments:
            if resource_store.get_by_id(asgn.resource_id) is None:
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Resource '{asgn.resource_id}' does not exist.",
                )
            if incident_store.get_by_id(asgn.incident_id) is None:
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Incident '{asgn.incident_id}' referenced in assignment does not exist.",
                )

    # -----------------------------------------------------------------------
    # CRUD
    # -----------------------------------------------------------------------
    def get_all(self, status: Optional[str] = None) -> List[ResponsePlanResponse]:
        plans = list(self._store.values())
        if status:
            st = status.lower().strip()
            plans = [p for p in plans if p.status.value == st]
        plans.sort(key=lambda p: p.created_at, reverse=True)
        return plans

    def get_by_id(self, plan_id: str) -> Optional[ResponsePlanResponse]:
        return self._store.get(plan_id)

    def create(self, payload: ResponsePlanCreate, actor: str = "operator") -> ResponsePlanResponse:
        # Validate referenced entities
        self._validate_incidents(payload.incident_ids)
        self._validate_resources(payload.resource_assignments)

        plan_id = payload.plan_id if payload.plan_id else f"plan-{uuid4().hex[:8]}"
        if plan_id in self._store:
            plan_id = f"plan-{uuid4().hex[:8]}"

        assignments = _build_assignments(payload.resource_assignments)
        ert = _compute_ert(assignments)
        now = utc_now()

        plan = ResponsePlanResponse(
            id=plan_id,
            status=payload.status,
            incident_ids=payload.incident_ids,
            resource_assignments=assignments,
            estimated_response_times=ert,
            created_at=now,
            updated_at=now,
        )
        self._store[plan_id] = plan

        event_service.record(
            event_type=EventType.PLAN_CREATED,
            description=(
                f"Response plan {plan_id} created with status '{plan.status.value}'. "
                f"Covers {len(plan.incident_ids)} incident(s), "
                f"{len(plan.resource_assignments)} assignment(s)."
            ),
            actor=actor,
            payload={
                "plan_id": plan_id,
                "status": plan.status.value,
                "incident_count": len(plan.incident_ids),
                "assignment_count": len(plan.resource_assignments),
            },
        )
        broadcast_plan_created(plan)
        return plan

    def update(
        self, plan_id: str, payload: ResponsePlanUpdate, actor: str = "operator"
    ) -> ResponsePlanResponse:
        plan = self._store.get(plan_id)
        if plan is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Response plan '{plan_id}' not found.",
            )

        updates = payload.model_dump(exclude_unset=True)

        # Validate any newly supplied incidents / assignments
        if "incident_ids" in updates:
            self._validate_incidents(updates["incident_ids"])
        if "resource_assignments" in updates and updates["resource_assignments"]:
            raw_asgns = [ResourceAssignment(**a) if isinstance(a, dict) else a
                         for a in updates["resource_assignments"]]
            self._validate_resources(raw_asgns)
            updates["resource_assignments"] = _build_assignments(updates["resource_assignments"])

        data = plan.model_dump()
        data.update(updates)

        # Rebuild assignments with fresh ETAs and recompute ERT
        raw_assignments = data.get("resource_assignments", [])
        data["resource_assignments"] = _build_assignments(raw_assignments)
        data["estimated_response_times"] = _compute_ert(data["resource_assignments"])
        data["updated_at"] = utc_now()

        updated = ResponsePlanResponse(**data)
        self._store[plan_id] = updated

        changed = list(updates.keys())
        event_service.record(
            event_type=EventType.PLAN_UPDATED,
            description=(
                f"Response plan {plan_id} updated. "
                f"Changed fields: {', '.join(changed)}. "
                f"New status: '{updated.status.value}'."
            ),
            actor=actor,
            payload={"plan_id": plan_id, "changed": changed, "status": updated.status.value},
        )
        broadcast_plan_updated(updated, changed)
        return updated

    def reset(self) -> None:
        self._store.clear()
        self._seed()


# Module-level singleton
response_plan_store = ResponsePlanStore()
