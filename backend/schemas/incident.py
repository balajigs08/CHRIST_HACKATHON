"""Incident data models and schemas (Phase 2)."""
from datetime import datetime
from typing import List, Optional, Union
from uuid import uuid4

from pydantic import Field, field_validator

from schemas.base import BaseSchema, utc_now
from schemas.enums import IncidentSeverity, IncidentStatus, ResourceType


class IncidentBase(BaseSchema):
    """Base fields shared across incident representations."""
    type: str = Field(..., min_length=1, max_length=100, description="Incident classification type")
    description: str = Field(..., min_length=1, description="Detailed explanation of the emergency")
    location: str = Field(..., min_length=1, max_length=255, description="Human-readable location address or landmark")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 latitude coordinate (-90 to 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 longitude coordinate (-180 to 180)")
    severity: IncidentSeverity = Field(..., description="Severity level: critical, high, medium, low")
    urgency: int = Field(..., ge=1, le=10, description="Urgency score from 1 (lowest) to 10 (highest)")
    status: IncidentStatus = Field(default=IncidentStatus.REPORTED, description="Current workflow state")
    required_resources: List[ResourceType] = Field(
        default_factory=list,
        description="Required types of emergency response units"
    )

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

    @field_validator("required_resources", mode="before")
    @classmethod
    def normalize_required_resources(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            res = []
            for item in v:
                if isinstance(item, str):
                    res.append(item.lower().strip())
                else:
                    res.append(item)
            return res
        return v


class IncidentCreate(IncidentBase):
    """Request schema for creating a new incident."""
    incident_id: Optional[str] = Field(default=None, validation_alias="id", description="Optional custom ID; generated if omitted")


class IncidentUpdate(BaseSchema):
    """Request schema for partial incident updates."""
    type: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, min_length=1)
    location: Optional[str] = Field(default=None, min_length=1, max_length=255)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    severity: Optional[IncidentSeverity] = None
    urgency: Optional[int] = Field(default=None, ge=1, le=10)
    status: Optional[IncidentStatus] = None
    required_resources: Optional[List[ResourceType]] = None

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

    @field_validator("required_resources", mode="before")
    @classmethod
    def normalize_required_resources(cls, v):
        if v is None:
            return None
        if isinstance(v, list):
            res = []
            for item in v:
                if isinstance(item, str):
                    res.append(item.lower().strip())
                else:
                    res.append(item)
            return res
        return v



class IncidentResponse(IncidentBase):
    """Response schema representing an incident."""
    incident_id: str = Field(
        default_factory=lambda: f"inc-{uuid4().hex[:8]}",
        description="Unique incident identifier",
        validation_alias="id",
    )
    created_at: datetime = Field(default_factory=utc_now, description="UTC timestamp of creation")
    updated_at: datetime = Field(default_factory=utc_now, description="UTC timestamp of last update")


# Alias for general model representation
Incident = IncidentResponse

