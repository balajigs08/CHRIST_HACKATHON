"""In-memory human approval store (Phase 9).

Provides CRUD operations, status resolution (approve/reject), audit logging,
and real-time WebSocket broadcasts for operator approval requests.
No database, no AI, no optimization.
"""
from typing import Dict, List, Optional
from uuid import uuid4

from schemas.base import utc_now
from schemas.enums import ApprovalRequestType, ApprovalStatus, EventType
from schemas.approval import (
    HumanApprovalRequestCreate,
    HumanApprovalRequestResponse,
    HumanApprovalRequestUpdate,
)
from services.event_service import event_service
from services.broadcaster import (
    broadcast_approval_created,
    broadcast_approval_resolved,
    broadcast_approval_updated,
)


_SEED_APPROVALS = [
    {
        "request_id": "appr-seed-001",
        "type": ApprovalRequestType.RESOURCE_REALLOCATION,
        "description": "Reallocate RES-AMB-02 from Indiranagar depot standby to critical building collapse at Whitefield",
        "reason": "High-casualty multi-storey building collapse with 4+ trapped individuals requires second ALS ambulance unit immediately.",
        "impact": "Temporary delay for non-critical transfers in Indiranagar sector.",
        "incident_id": "inc-seed-001",
        "resource_id": "RES-AMB-02",
        "status": ApprovalStatus.PENDING,
    },
    {
        "request_id": "appr-seed-002",
        "type": ApprovalRequestType.EMERGENCY_DISPATCH,
        "description": "Emergency dispatch authorization of specialized hazardous materials containment team",
        "reason": "Gas leak detection in densely populated residential zone (inc-seed-005).",
        "impact": "Mobilizes specialized municipal disaster response tier 2 team.",
        "incident_id": "inc-seed-005",
        "resource_id": "RES-RESC-01",
        "status": ApprovalStatus.PENDING,
    },
    {
        "request_id": "appr-seed-003",
        "type": ApprovalRequestType.MANUAL_OVERRIDE,
        "description": "Override maintenance status of RES-MED-02 for mass-casualty triage staging",
        "reason": "Stationary medical unit vehicle engine maintenance can be deferred for non-mobile triage.",
        "impact": "Vehicle cannot self-relocate; requires stationary deployment.",
        "incident_id": "inc-seed-001",
        "resource_id": "RES-MED-02",
        "status": ApprovalStatus.PENDING,
    },
    {
        "request_id": "appr-seed-004",
        "type": ApprovalRequestType.RESPONSE_PLAN_CHANGE,
        "description": "Approve perimeter expansion and route diversion for response plan plan-seed-001",
        "reason": "Secondary road blockages identified on Outer Ring Road.",
        "impact": "Re-routes two fire tenders and one rescue unit via Old Airport Road.",
        "incident_id": "inc-seed-001",
        "resource_id": None,
        "status": ApprovalStatus.APPROVED,
        "resolved_at": "2026-09-30T11:00:00Z",
        "resolved_by": "supervisor_chen",
        "note": "Route diversion verified with traffic police.",
    },
]


class ApprovalStore:
    """In-memory store for human approval requests."""

    def __init__(self) -> None:
        self._store: Dict[str, HumanApprovalRequestResponse] = {}
        self._seed()

    def _seed(self) -> None:
        now = utc_now()
        for s in _SEED_APPROVALS:
            resolved_at = s.get("resolved_at")
            if resolved_at and isinstance(resolved_at, str):
                from datetime import datetime
                try:
                    resolved_at = datetime.fromisoformat(resolved_at.replace("Z", "+00:00"))
                except Exception:
                    resolved_at = now

            req = HumanApprovalRequestResponse(
                id=s["request_id"],
                type=s["type"],
                description=s["description"],
                reason=s["reason"],
                impact=s.get("impact"),
                incident_id=s.get("incident_id"),
                resource_id=s.get("resource_id"),
                status=s["status"],
                created_at=now,
                resolved_at=resolved_at,
                resolved_by=s.get("resolved_by"),
                note=s.get("note"),
            )
            self._store[s["request_id"]] = req

    def get_all(
        self,
        type: Optional[str] = None,
        status: Optional[str] = None,
        incident_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[HumanApprovalRequestResponse]:
        results = list(self._store.values())

        if type:
            type_norm = type.strip().lower()
            results = [r for r in results if r.type.value.lower() == type_norm]

        if status:
            stat_norm = status.strip().lower()
            results = [r for r in results if r.status.value.lower() == stat_norm]

        if incident_id:
            results = [r for r in results if r.incident_id == incident_id]

        if resource_id:
            results = [r for r in results if r.resource_id == resource_id]

        if search:
            q = search.strip().lower()
            results = [
                r for r in results
                if q in r.description.lower()
                or q in r.reason.lower()
                or (r.impact and q in r.impact.lower())
                or (r.incident_id and q in r.incident_id.lower())
                or (r.resource_id and q in r.resource_id.lower())
                or q in r.type.value.lower()
            ]

        results.sort(key=lambda r: r.created_at, reverse=True)
        return results

    def get_by_id(self, request_id: str) -> Optional[HumanApprovalRequestResponse]:
        return self._store.get(request_id)

    def create(
        self, payload: HumanApprovalRequestCreate, actor: str = "system"
    ) -> HumanApprovalRequestResponse:
        req_id = payload.request_id if payload.request_id else f"appr-{uuid4().hex[:8]}"
        if req_id in self._store:
            req_id = f"appr-{uuid4().hex[:8]}"

        now = utc_now()
        req = HumanApprovalRequestResponse(
            id=req_id,
            type=payload.type,
            description=payload.description,
            reason=payload.reason,
            impact=payload.impact,
            incident_id=payload.incident_id,
            resource_id=payload.resource_id,
            status=payload.status,
            created_at=now,
            resolved_at=None,
            resolved_by=None,
            note=None,
        )
        self._store[req_id] = req

        event_service.record(
            event_type=EventType.APPROVAL_REQUESTED,
            description=(
                f"Human approval requested [{req.type.value}]: {req.description} ({req_id})"
            ),
            incident_id=req.incident_id,
            resource_id=req.resource_id,
            actor=actor,
            payload={
                "request_id": req_id,
                "type": req.type.value,
                "reason": req.reason,
                "impact": req.impact,
            },
        )
        broadcast_approval_created(req)
        return req

    def update(
        self, request_id: str, payload: HumanApprovalRequestUpdate, actor: str = "operator"
    ) -> Optional[HumanApprovalRequestResponse]:
        req = self._store.get(request_id)
        if req is None:
            return None

        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return req

        data = req.model_dump()
        data.update(updates)

        # Decision resolution handling
        new_status = updates.get("status")
        if new_status is not None:
            stat_str = str(new_status).lower()
            if stat_str in ("approved", "rejected"):
                data["resolved_at"] = utc_now()
                if not data.get("resolved_by"):
                    data["resolved_by"] = actor
            elif stat_str == "pending":
                data["resolved_at"] = None

        updated = HumanApprovalRequestResponse(**data)
        self._store[request_id] = updated

        changed_fields = list(updates.keys())
        if new_status is not None and str(new_status).lower() == "approved":
            evt_type = EventType.APPROVAL_APPROVED
            decision_desc = f"Approval {request_id} APPROVED by {updated.resolved_by or actor}."
        elif new_status is not None and str(new_status).lower() == "rejected":
            evt_type = EventType.APPROVAL_REJECTED
            decision_desc = f"Approval {request_id} REJECTED by {updated.resolved_by or actor}."
        else:
            evt_type = EventType.SYSTEM_INFO
            decision_desc = f"Approval {request_id} updated. Fields changed: {', '.join(changed_fields)}"

        event_service.record(
            event_type=evt_type,
            description=decision_desc,
            incident_id=updated.incident_id,
            resource_id=updated.resource_id,
            actor=actor,
            payload={
                "request_id": request_id,
                "status": updated.status.value,
                "note": updated.note,
                "resolved_by": updated.resolved_by,
                "changed": changed_fields,
            },
        )

        if new_status is not None and str(new_status).lower() in ("approved", "rejected"):
            broadcast_approval_resolved(updated, str(new_status))
        broadcast_approval_updated(updated, changed_fields)

        return updated

    def reset(self) -> None:
        self._store.clear()
        self._seed()


# Module-level singleton
approval_store = ApprovalStore()
