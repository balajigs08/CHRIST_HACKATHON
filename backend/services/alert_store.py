"""In-memory alert store (Phase 9).

Provides CRUD operations, filtering, and real-time broadcasts for emergency alerts.
No database, no AI, no optimization.
"""
from typing import Dict, List, Optional
from uuid import uuid4

from schemas.base import utc_now
from schemas.enums import AlertSeverity, AlertStatus, EventType
from schemas.alert import AlertCreate, AlertResponse, AlertUpdate
from services.event_service import event_service
from services.broadcaster import broadcast_alert_created, broadcast_alert_updated


_SEED_ALERTS = [
    {
        "alert_id": "alt-seed-001",
        "title": "Critical Gas Pipeline Pressure Spike",
        "description": "Telemetry sensors indicate rapid pressure surge near domestic distribution line in HSR Layout Sector 1.",
        "severity": AlertSeverity.CRITICAL,
        "incident_id": "inc-seed-005",
        "resource_id": None,
        "status": AlertStatus.ACTIVE,
        "requires_human_attention": True,
    },
    {
        "alert_id": "alt-seed-002",
        "title": "Severe Traffic Gridlock Delaying Ambulance",
        "description": "Outer Ring Road Marathahalli junction gridlock is adding 12+ minutes to RES-AMB-03 response ETA.",
        "severity": AlertSeverity.HIGH,
        "incident_id": "inc-seed-002",
        "resource_id": "RES-AMB-03",
        "status": AlertStatus.ACTIVE,
        "requires_human_attention": True,
    },
    {
        "alert_id": "alt-seed-003",
        "title": "Hazardous Material Smoke Detected",
        "description": "Secondary industrial smoke sensor triggered adjacent to commercial ITPL building complex.",
        "severity": AlertSeverity.CRITICAL,
        "incident_id": "inc-seed-001",
        "resource_id": "RES-FIRE-01",
        "status": AlertStatus.ACTIVE,
        "requires_human_attention": True,
    },
    {
        "alert_id": "alt-seed-004",
        "title": "Weather Warning: Localized Cloudburst",
        "description": "Meteorological Doppler radar predicts heavy rainfall cell exceeding 45mm/hr over central sectors.",
        "severity": AlertSeverity.MEDIUM,
        "incident_id": None,
        "resource_id": None,
        "status": AlertStatus.ACTIVE,
        "requires_human_attention": False,
    },
    {
        "alert_id": "alt-seed-005",
        "title": "Silk Board Underpass Drainage Cleared",
        "description": "Water pumps active and storm drain blockage removed. Underpass traffic flow restored.",
        "severity": AlertSeverity.LOW,
        "incident_id": "inc-seed-004",
        "resource_id": None,
        "status": AlertStatus.RESOLVED,
        "requires_human_attention": False,
        "resolved_at": "2026-09-30T10:00:00Z",
    },
]


class AlertStore:
    """In-memory store for emergency alerts."""

    def __init__(self) -> None:
        self._store: Dict[str, AlertResponse] = {}
        self._seed()

    def _seed(self) -> None:
        now = utc_now()
        for s in _SEED_ALERTS:
            resolved_at = s.get("resolved_at")
            if resolved_at and isinstance(resolved_at, str):
                from datetime import datetime, timezone
                try:
                    resolved_at = datetime.fromisoformat(resolved_at.replace("Z", "+00:00"))
                except Exception:
                    resolved_at = now

            alt = AlertResponse(
                id=s["alert_id"],
                title=s["title"],
                description=s["description"],
                severity=s["severity"],
                incident_id=s.get("incident_id"),
                resource_id=s.get("resource_id"),
                status=s["status"],
                requires_human_attention=s["requires_human_attention"],
                created_at=now,
                resolved_at=resolved_at,
            )
            self._store[s["alert_id"]] = alt

    def get_all(
        self,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        requires_human_attention: Optional[bool] = None,
        incident_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[AlertResponse]:
        results = list(self._store.values())

        if severity:
            sev_norm = severity.strip().lower()
            results = [a for a in results if a.severity.value.lower() == sev_norm]

        if status:
            stat_norm = status.strip().lower()
            results = [a for a in results if a.status.value.lower() == stat_norm]

        if requires_human_attention is not None:
            results = [a for a in results if a.requires_human_attention == requires_human_attention]

        if incident_id:
            results = [a for a in results if a.incident_id == incident_id]

        if resource_id:
            results = [a for a in results if a.resource_id == resource_id]

        if search:
            q = search.strip().lower()
            results = [
                a for a in results
                if q in a.title.lower()
                or q in a.description.lower()
                or (a.incident_id and q in a.incident_id.lower())
                or (a.resource_id and q in a.resource_id.lower())
            ]

        # Order newest first
        results.sort(key=lambda a: a.created_at, reverse=True)
        return results

    def get_by_id(self, alert_id: str) -> Optional[AlertResponse]:
        return self._store.get(alert_id)

    def create(self, payload: AlertCreate, actor: str = "system") -> AlertResponse:
        alt_id = payload.alert_id if payload.alert_id else f"alt-{uuid4().hex[:8]}"
        if alt_id in self._store:
            alt_id = f"alt-{uuid4().hex[:8]}"

        now = utc_now()
        alt = AlertResponse(
            id=alt_id,
            title=payload.title,
            description=payload.description,
            severity=payload.severity,
            incident_id=payload.incident_id,
            resource_id=payload.resource_id,
            status=payload.status,
            requires_human_attention=payload.requires_human_attention,
            created_at=now,
            resolved_at=None,
        )
        self._store[alt_id] = alt

        event_service.record(
            event_type=EventType.ALERT_TRIGGERED,
            description=f"Emergency Alert [{alt.severity.upper()}]: {alt.title}",
            incident_id=alt.incident_id,
            resource_id=alt.resource_id,
            actor=actor,
            payload={
                "alert_id": alt_id,
                "title": alt.title,
                "severity": alt.severity.value,
                "requires_human_attention": alt.requires_human_attention,
            },
        )
        broadcast_alert_created(alt)
        return alt

    def update(
        self, alert_id: str, payload: AlertUpdate, actor: str = "operator"
    ) -> Optional[AlertResponse]:
        alt = self._store.get(alert_id)
        if alt is None:
            return None

        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return alt

        data = alt.model_dump()
        data.update(updates)

        # Auto-set resolved_at if status changed to resolved and resolved_at is not explicitly provided
        new_status = updates.get("status")
        if new_status and str(new_status).lower() == "resolved" and not data.get("resolved_at"):
            data["resolved_at"] = utc_now()
        elif new_status and str(new_status).lower() != "resolved":
            data["resolved_at"] = None

        updated = AlertResponse(**data)
        self._store[alert_id] = updated

        changed_fields = list(updates.keys())
        evt_type = (
            EventType.ALERT_RESOLVED
            if updated.status == AlertStatus.RESOLVED
            else EventType.SYSTEM_INFO
        )
        event_service.record(
            event_type=evt_type,
            description=f"Alert {alert_id} updated. Fields changed: {', '.join(changed_fields)}",
            incident_id=updated.incident_id,
            resource_id=updated.resource_id,
            actor=actor,
            payload={"alert_id": alert_id, "changed": changed_fields, "new_values": updates},
        )
        broadcast_alert_updated(updated, changed_fields)
        return updated

    def reset(self) -> None:
        self._store.clear()
        self._seed()


# Module-level singleton
alert_store = AlertStore()
