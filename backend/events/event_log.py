from datetime import datetime
from typing import Optional

from models.schemas import Event, EventType


class EventLog:
    """Append-only audit log."""

    def __init__(self):
        self.events: list[Event] = []
        self._n = 0

    @property
    def counter(self) -> int:
        return self._n

    def restore(self, events: list[Event], counter: int) -> None:
        self.events, self._n = list(events), max(counter, len(events))

    def clear(self) -> None:
        self.events, self._n = [], 0

    def record(self, event_type: EventType, timestamp: datetime, description: str,
               affected: Optional[list[str]] = None, previous: Optional[dict] = None,
               new: Optional[dict] = None, reason: Optional[str] = None) -> Event:
        self._n += 1
        ev = Event(id=f"EVT{self._n:04d}", event_type=event_type, timestamp=timestamp,
                   description=description, affected_entities=affected or [],
                   previous_state=previous, new_state=new, reason=reason)
        self.events.append(ev)
        return ev

    def list(self, limit: int = 500) -> list[Event]:
        return self.events[-limit:]
