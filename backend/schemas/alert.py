"""Alert data models and schemas (Phase 2)."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import Field, field_validator

from schemas.base import BaseSchema, utc_now
from schemas.enums import AlertSeverity, AlertStatus


class AlertBase(BaseSchema):
    """Base fields shared across alert representations."""
    title: str = Field(..., min_length=1, max_length=200, description="Short summary of the alert condition")
    description: str = Field(..., min_length=1, description="Detailed explanation of the alert")
    severity: AlertSeverity = Field(..., description="Alert severity: critical, high, medium, low, info")
    incident_id: Optional[str] = Field(default=None, description="Related incident ID if applicable")
    resource_id: Optional[str] = Field(default=None, description="Related resource ID if applicable")
    status: AlertStatus = Field(default=AlertStatus.ACTIVE, description="Current alert lifecycle state")
    requires_human_attention: bool = Field(default=True, description="Flag indicating operator intervention is required")

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


class AlertCreate(AlertBase):
    """Request schema for creating a new alert."""
    alert_id: Optional[str] = Field(default=None, validation_alias="id", description="Optional custom ID")


class AlertUpdate(BaseSchema):
    """Request schema for updating an alert state."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1)
    severity: Optional[AlertSeverity] = None
    status: Optional[AlertStatus] = None
    requires_human_attention: Optional[bool] = None
    incident_id: Optional[str] = None
    resource_id: Optional[str] = None
    resolved_at: Optional[datetime] = None


class AlertResponse(AlertBase):
    """Response schema representing an emergency alert."""
    alert_id: str = Field(default_factory=lambda: f"alt-{uuid4().hex[:8]}", validation_alias="id", description="Unique alert identifier")
    created_at: datetime = Field(default_factory=utc_now, description="UTC timestamp of alert generation")
    resolved_at: Optional[datetime] = Field(default=None, description="UTC timestamp when alert was resolved")


# Alias for general model representation
Alert = AlertResponse
