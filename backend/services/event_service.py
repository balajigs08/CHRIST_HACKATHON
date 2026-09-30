"""Event Service — in-memory audit log (Phase 7 extended).

Provides a lightweight, in-memory audit trail for domain events.
No database, no WebSocket, no AI.
"""
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from schemas.base import utc_now
from schemas.enums import EventType
from schemas.event import EventCreate, EventResponse


class EventService:
    """In-memory audit log service with filtering, pagination, and seed events."""

    def __init__(self) -> None:
        self._store: Dict[str, EventResponse] = {}
        self._ordered: List[str] = []   # insertion-ordered IDs for stable pagination
        self._seed()

    def _seed(self) -> None:
        """Pre-populate the audit log with realistic startup events."""
        _seed_data = [
            (EventType.INCIDENT_REPORTED,    "System initialised: 5 active incidents loaded into registry",         "inc-seed-001", None,         "system"),
            (EventType.RESOURCE_UPDATED,     "System initialised: 12 emergency resources registered in fleet",      None,           "RES-AMB-01", "system"),
            (EventType.PLAN_CREATED,         "Response plan plan-seed-001 activated for Whitefield fire complex",    "inc-seed-001", "RES-FIRE-01","system"),
            (EventType.RESOURCE_ASSIGNED,    "RES-AMB-03 dispatched to road accident at Marathahalli (inc-seed-002)","inc-seed-002", "RES-AMB-03", "operator"),
            (EventType.RESOURCE_ASSIGNED,    "RES-RESC-02 deployed for building fire rescue operations",            "inc-seed-001", "RES-RESC-02","operator"),
            (EventType.INCIDENT_UPDATED,     "Severity escalated to CRITICAL for gas leak at HSR Layout (inc-seed-005)","inc-seed-005",None,       "operator"),
        ]
        for (evt_type, desc, inc_id, res_id, actor) in _seed_data:
            self.record(
                event_type=evt_type,
                description=desc,
                incident_id=inc_id,
                resource_id=res_id,
                actor=actor,
            )

    # -----------------------------------------------------------------------
    # Write
    # -----------------------------------------------------------------------
    def record(
        self,
        event_type: EventType,
        description: str,
        incident_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        actor: str = "system",
        payload: Optional[dict] = None,
        previous_state: Optional[dict] = None,
        new_state: Optional[dict] = None,
    ) -> EventResponse:
        """Record a new audit event and return it."""
        event_id = f"evt-{uuid4().hex[:8]}"
        evt = EventResponse(
            id=event_id,
            event_type=event_type,
            description=description,
            incident_id=incident_id,
            resource_id=resource_id,
            actor=actor,
            payload=payload,
            previous_state=previous_state,
            new_state=new_state,
            timestamp=utc_now(),
        )
        self._store[event_id] = evt
        self._ordered.append(event_id)
        return evt

    def record_from_create(self, payload: EventCreate) -> EventResponse:
        """Record an event from an EventCreate request (POST /api/events)."""
        event_id = payload.event_id if payload.event_id else f"evt-{uuid4().hex[:8]}"
        if event_id in self._store:
            event_id = f"evt-{uuid4().hex[:8]}"
        ts = payload.timestamp if payload.timestamp else utc_now()
        evt = EventResponse(
            id=event_id,
            event_type=payload.event_type,
            description=payload.description,
            incident_id=payload.incident_id,
            resource_id=payload.resource_id,
            actor=payload.actor,
            payload=payload.payload,
            previous_state=payload.previous_state,
            new_state=payload.new_state,
            timestamp=ts,
        )
        self._store[event_id] = evt
        self._ordered.append(event_id)
        return evt

    # -----------------------------------------------------------------------
    # Read
    # -----------------------------------------------------------------------
    def get_by_id(self, event_id: str) -> Optional[EventResponse]:
        return self._store.get(event_id)

    def list_events(
        self,
        event_type: Optional[str] = None,
        incident_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        actor: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[List[EventResponse], int]:
        """Return a paginated, filtered list of events (newest first).

        Returns (items, total_count).
        """
        # Build full set newest-first using insertion order
        events = [self._store[eid] for eid in reversed(self._ordered) if eid in self._store]

        # Apply filters
        if event_type:
            et = event_type.lower().strip()
            events = [e for e in events if e.event_type.value == et]
        if incident_id:
            events = [e for e in events if e.incident_id == incident_id]
        if resource_id:
            events = [e for e in events if e.resource_id == resource_id]
        if actor:
            a = actor.lower().strip()
            events = [e for e in events if e.actor.lower() == a]
        if search:
            q = search.lower().strip()
            events = [
                e for e in events
                if q in e.description.lower()
                or q in e.event_type.value.lower()
                or (e.incident_id and q in e.incident_id.lower())
                or (e.resource_id and q in e.resource_id.lower())
                or q in e.actor.lower()
            ]

        total = len(events)
        start = (page - 1) * limit
        return events[start: start + limit], total

    def list_by_incident(self, incident_id: str, limit: int = 100) -> List[EventResponse]:
        """All events for a specific incident, newest first."""
        return [
            self._store[eid]
            for eid in reversed(self._ordered)
            if eid in self._store and self._store[eid].incident_id == incident_id
        ][:limit]

    def list_by_resource(self, resource_id: str, limit: int = 100) -> List[EventResponse]:
        """All events for a specific resource, newest first."""
        return [
            self._store[eid]
            for eid in reversed(self._ordered)
            if eid in self._store and self._store[eid].resource_id == resource_id
        ][:limit]

    def clear(self) -> None:
        """Reset the store (used in tests)."""
        self._store.clear()
        self._ordered.clear()

    @property
    def total_count(self) -> int:
        return len(self._store)


# Module-level singleton consumed by all domain stores
event_service = EventService()
