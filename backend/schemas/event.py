"""Event and Audit Log data models and schemas (Phase 2 / Phase 7)."""
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

from pydantic import Field, field_validator

from schemas.base import BaseSchema, utc_now
from schemas.enums import EventType


class EventBase(BaseSchema):
    """Base fields for an event / audit log entry."""
    event_type: EventType = Field(..., description="Categorical type of the event")
    description: str = Field(..., min_length=1, description="Human-readable description of what occurred")
    incident_id: Optional[str] = Field(default=None, description="Associated incident ID if applicable")
    resource_id: Optional[str] = Field(default=None, description="Associated resource ID if applicable")
    actor: str = Field(default="system", min_length=1, description="Originating actor: system, operator, or agent")
    payload: Optional[Dict[str, Any]] = Field(default=None, description="Optional structured metadata")
    previous_state: Optional[Dict[str, Any]] = Field(default=None, description="State snapshot before the change")
    new_state: Optional[Dict[str, Any]] = Field(default=None, description="State snapshot after the change")

    @field_validator("event_type", mode="before")
    @classmethod
    def normalize_event_type(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v


class EventCreate(EventBase):
    """Request schema for recording an audit event."""
    event_id: Optional[str] = Field(default=None, validation_alias="id", description="Optional custom ID")
    timestamp: Optional[datetime] = Field(default=None, description="Optional custom timestamp; defaults to now")


class EventResponse(EventBase):
    """Response schema representing an audit event."""
    event_id: str = Field(
        default_factory=lambda: f"evt-{uuid4().hex[:8]}",
        validation_alias="id",
        description="Unique event identifier",
    )
    timestamp: datetime = Field(default_factory=utc_now, description="UTC timestamp when the event occurred")


# Aliases for general model representation
Event = EventResponse
AuditLog = EventResponse


