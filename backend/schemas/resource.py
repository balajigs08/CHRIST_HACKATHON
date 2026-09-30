"""Resource data models and schemas (Phase 2)."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import Field, field_validator

from schemas.base import BaseSchema, utc_now
from schemas.enums import ResourceStatus, ResourceType


class ResourceBase(BaseSchema):
    """Base fields shared across resource representations."""
    type: ResourceType = Field(..., description="Type of emergency response unit")
    location: str = Field(..., min_length=1, max_length=255, description="Station, depot, or landmark location")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 latitude coordinate (-90 to 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 longitude coordinate (-180 to 180)")
    status: ResourceStatus = Field(default=ResourceStatus.AVAILABLE, description="Current operational state")
    assigned_incident_id: Optional[str] = Field(default=None, description="ID of assigned incident, if any")
    availability: bool = Field(default=True, description="Whether resource is ready for immediate deployment")

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v


class ResourceCreate(ResourceBase):
    """Request schema for creating a new emergency resource."""
    resource_id: Optional[str] = Field(default=None, validation_alias="id", description="Optional custom ID; generated if omitted")


class ResourceUpdate(BaseSchema):
    """Request schema for updating an existing resource."""
    type: Optional[ResourceType] = None
    location: Optional[str] = Field(default=None, min_length=1, max_length=255)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    status: Optional[ResourceStatus] = None
    assigned_incident_id: Optional[str] = None
    availability: Optional[bool] = None

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v


class ResourceResponse(ResourceBase):
    """Response schema representing an emergency resource."""
    resource_id: str = Field(
        default_factory=lambda: f"res-{uuid4().hex[:8]}",
        description="Unique resource identifier",
        validation_alias="id",
    )
    updated_at: datetime = Field(default_factory=utc_now, description="UTC timestamp of last status/location update")


# Alias for general model representation
Resource = ResourceResponse

