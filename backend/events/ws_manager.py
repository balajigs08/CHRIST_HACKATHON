import json
from typing import Any

from fastapi import WebSocket

from models.schemas import Event, EventType

WS_TYPE = {
    EventType.INCIDENT_CREATED: "incident_created",
    EventType.INCIDENT_UPDATED: "incident_updated",
    EventType.INCIDENT_ESCALATED: "incident_updated",
    EventType.RESOURCE_AVAILABLE: "resource_updated",
    EventType.RESOURCE_UPDATED: "resource_updated",
    EventType.RESOURCE_UNAVAILABLE: "resource_unavailable",
    EventType.RESOURCE_ASSIGNED: "resource_assigned",
    EventType.RESOURCE_REALLOCATED: "resource_reallocated",
    EventType.PLAN_RECALCULATED: "plan_recalculated",
    EventType.HUMAN_APPROVAL_REQUIRED: "human_approval_required",
    EventType.BOUNDARY_COLLAPSE: "boundary_collapse",
    EventType.APPROVAL_APPROVED: "approval_resolved",
    EventType.APPROVAL_REJECTED: "approval_resolved",
    EventType.SCENARIO_RESET: "scenario_reset",
    EventType.TIME_ADVANCED: "time_advanced",
}


class ConnectionManager:
    def __init__(self):
        self.connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.connections.discard(ws)

    async def _send_all(self, message: dict[str, Any]) -> None:
        text = json.dumps(message)
        for ws in list(self.connections):
            try:
                await ws.send_text(text)
            except Exception:  # client went away: drop it, never crash the operation
                self.disconnect(ws)

    async def publish(self, events: list[Event], snapshot: dict) -> None:
        """One message per event, then one authoritative state snapshot."""
        if not self.connections:
            return
        for ev in events:
            await self._send_all({"type": WS_TYPE[ev.event_type], "event": ev.model_dump(mode="json")})
        await self._send_all({"type": "state_snapshot", "snapshot": snapshot})
