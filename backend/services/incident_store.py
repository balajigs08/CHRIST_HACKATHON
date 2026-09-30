"""In-memory incident store (Phase 3).

Provides a thread-safe-enough, single-process in-memory store for incidents.
No database, no AI, no optimization, no WebSocket.
"""
from typing import Dict, List, Optional
from uuid import uuid4

from schemas.base import utc_now
from schemas.enums import EventType, IncidentSeverity, IncidentStatus, ResourceType
from schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
from services.event_service import event_service
from services.broadcaster import broadcast_incident_created, broadcast_incident_updated


# ---------------------------------------------------------------------------
# Seed data — realistic Bengaluru incidents
# ---------------------------------------------------------------------------
_SEED_INCIDENTS = [
    {
        "incident_id": "inc-seed-001",
        "type": "Building Fire",
        "description": "Multi-storey commercial building fire with heavy smoke. Several people reported trapped on upper floors.",
        "location": "Whitefield Main Road, near ITPL Gate 2",
        "latitude": 12.9698,
        "longitude": 77.7500,
        "severity": "critical",
        "urgency": 10,
        "status": "in_progress",
        "required_resources": ["fire_team", "ambulance", "rescue_team"],
    },
    {
        "incident_id": "inc-seed-002",
        "type": "Road Accident",
        "description": "Three-vehicle pile-up on Outer Ring Road near Marathahalli flyover. Two persons injured, one critically.",
        "location": "Outer Ring Road, Marathahalli Junction",
        "latitude": 12.9591,
        "longitude": 77.6974,
        "severity": "high",
        "urgency": 8,
        "status": "dispatched",
        "required_resources": ["ambulance", "police"],
    },
    {
        "incident_id": "inc-seed-003",
        "type": "Medical Emergency",
        "description": "Reported cardiac arrest at a metro station. Bystander performing CPR. AED available on site.",
        "location": "Indiranagar Metro Station",
        "latitude": 12.9784,
        "longitude": 77.6408,
        "severity": "critical",
        "urgency": 9,
        "status": "reported",
        "required_resources": ["ambulance", "medical_unit"],
    },
    {
        "incident_id": "inc-seed-004",
        "type": "Flooding",
        "description": "Severe waterlogging blocking Silk Board flyover. Multiple vehicles stranded, no casualties yet reported.",
        "location": "Silk Board Junction, Hosur Road",
        "latitude": 12.9176,
        "longitude": 77.6238,
        "severity": "medium",
        "urgency": 5,
        "status": "assessed",
        "required_resources": ["rescue_team"],
    },
    {
        "incident_id": "inc-seed-005",
        "type": "Gas Leak",
        "description": "LPG gas leak reported in a residential complex. Residents evacuated from 3 floors. No ignition yet.",
        "location": "HSR Layout Sector 2",
        "latitude": 12.9116,
        "longitude": 77.6389,
        "severity": "high",
        "urgency": 7,
        "status": "reported",
        "required_resources": ["fire_team", "medical_unit"],
    },
]


class IncidentStore:
    """In-memory store for emergency incidents."""

    def __init__(self) -> None:
        self._store: Dict[str, IncidentResponse] = {}
        self._seed()

    def _seed(self) -> None:
        """Populate the store with realistic demo incidents on startup."""
        now = utc_now()
        for raw in _SEED_INCIDENTS:
            inc_id = raw["incident_id"]
            inc = IncidentResponse(
                id=inc_id,
                type=raw["type"],
                description=raw["description"],
                location=raw["location"],
                latitude=raw["latitude"],
                longitude=raw["longitude"],
                severity=raw["severity"],
                urgency=raw["urgency"],
                status=raw["status"],
                required_resources=raw["required_resources"],
                created_at=now,
                updated_at=now,
            )
            self._store[inc_id] = inc

    # -----------------------------------------------------------------------
    # CRUD helpers
    # -----------------------------------------------------------------------
    def get_all(
        self,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        incident_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[IncidentResponse]:
        """Return incidents with optional filtering."""
        incidents = list(self._store.values())

        if severity:
            sev = severity.lower().strip()
            incidents = [i for i in incidents if i.severity.value == sev]

        if status:
            st = status.lower().strip()
            incidents = [i for i in incidents if i.status.value == st]

        if incident_type:
            typ = incident_type.lower().strip()
            incidents = [i for i in incidents if typ in i.type.lower()]

        if search:
            q = search.lower().strip()
            incidents = [
                i for i in incidents
                if q in i.type.lower()
                or q in i.description.lower()
                or q in i.location.lower()
            ]

        # Newest first (highest urgency first within same timestamp)
        incidents.sort(key=lambda i: (i.created_at, i.urgency), reverse=True)
        return incidents

    def get_by_id(self, incident_id: str) -> Optional[IncidentResponse]:
        return self._store.get(incident_id)

    def create(self, payload: IncidentCreate, actor: str = "operator") -> IncidentResponse:
        """Create and store a new incident; emit an audit event."""
        inc_id = (
            payload.incident_id
            if payload.incident_id
            else f"inc-{uuid4().hex[:8]}"
        )
        if inc_id in self._store:
            # Prefer a fresh ID if the provided one already exists
            inc_id = f"inc-{uuid4().hex[:8]}"

        now = utc_now()
        inc = IncidentResponse(
            id=inc_id,
            type=payload.type,
            description=payload.description,
            location=payload.location,
            latitude=payload.latitude,
            longitude=payload.longitude,
            severity=payload.severity,
            urgency=payload.urgency,
            status=payload.status,
            required_resources=payload.required_resources,
            created_at=now,
            updated_at=now,
        )
        self._store[inc_id] = inc

        event_service.record(
            event_type=EventType.INCIDENT_REPORTED,
            description=f"New incident created: [{inc.severity.upper()}] {inc.type} at {inc.location}",
            incident_id=inc_id,
            actor=actor,
            payload={
                "type": inc.type,
                "severity": inc.severity.value,
                "urgency": inc.urgency,
                "location": inc.location,
            },
        )
        broadcast_incident_created(inc)
        return inc

    def update(
        self, incident_id: str, payload: IncidentUpdate, actor: str = "operator"
    ) -> Optional[IncidentResponse]:
        """Partially update an incident; emit an audit event."""
        inc = self._store.get(incident_id)
        if inc is None:
            return None

        data = inc.model_dump()
        updates = payload.model_dump(exclude_none=True)
        data.update(updates)
        data["updated_at"] = utc_now()

        updated = IncidentResponse(**data)
        self._store[incident_id] = updated

        changed_fields = list(updates.keys())
        event_service.record(
            event_type=EventType.INCIDENT_UPDATED,
            description=(
                f"Incident {incident_id} updated. Changed fields: {', '.join(changed_fields)}"
            ),
            incident_id=incident_id,
            actor=actor,
            payload={"changed": changed_fields, "new_values": updates},
        )
        broadcast_incident_updated(updated, changed_fields)
        return updated

    def delete(self, incident_id: str) -> bool:
        """Remove an incident. Returns True if it existed."""
        if incident_id not in self._store:
            return False
        del self._store[incident_id]
        event_service.record(
            event_type=EventType.INCIDENT_UPDATED,
            description=f"Incident {incident_id} deleted from the active incident list.",
            incident_id=incident_id,
            actor="operator",
        )
        return True

    def reset(self) -> None:
        """Wipe and re-seed (useful for tests)."""
        self._store.clear()
        self._seed()


# Module-level singleton
incident_store = IncidentStore()
