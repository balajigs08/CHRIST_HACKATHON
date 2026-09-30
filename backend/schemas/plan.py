"""Response Plan data models and schemas (Phase 2 / Phase 6)."""
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from pydantic import Field, field_validator

from schemas.base import BaseSchema, utc_now
from schemas.enums import PlanStatus


class ResourceAssignment(BaseSchema):
    """Assignment linking an emergency resource to an incident."""
    assignment_id: Optional[str] = Field(
        default_factory=lambda: f"asgn-{uuid4().hex[:8]}",
        validation_alias="id",
        description="Unique assignment identifier",
    )
    incident_id: str = Field(..., min_length=1, description="Target incident identifier")
    resource_id: str = Field(..., min_length=1, description="Assigned resource identifier")
    role: Optional[str] = Field(default=None, description="Operational role or designation")
    eta_minutes: Optional[float] = Field(default=None, ge=0.0, description="Estimated arrival time in minutes")
    distance_km: Optional[float] = Field(default=None, ge=0.0, description="Road-corrected distance in km")
    assignment_status: str = Field(default="assigned", description="Assignment lifecycle status: assigned, en_route, on_scene, released")
    assigned_at: datetime = Field(default_factory=utc_now, description="UTC timestamp when assignment was created")


PlanAssignment = ResourceAssignment  # Backwards compatibility alias


class ResponsePlanBase(BaseSchema):
    """Base fields shared across response plan representations."""
    status: PlanStatus = Field(default=PlanStatus.PENDING, description="Current workflow state of the response plan")
    incident_ids: List[str] = Field(default_factory=list, description="List of incident IDs included in this plan")
    resource_assignments: List[ResourceAssignment] = Field(
        default_factory=list,
        description="Assigned resources mapped to incidents",
    )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return v.lower().strip().replace(" ", "_")
        return v


class ResponsePlanCreate(ResponsePlanBase):
    """Request schema for creating a response plan."""
    plan_id: Optional[str] = Field(default=None, validation_alias="id", description="Optional custom plan ID")


class ResponsePlanUpdate(BaseSchema):
    """Request schema for updating a response plan."""
    status: Optional[PlanStatus] = None
    incident_ids: Optional[List[str]] = None
    resource_assignments: Optional[List[ResourceAssignment]] = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return v.lower().strip().replace(" ", "_")
        return v


class ResponsePlanResponse(ResponsePlanBase):
    """Response schema representing an emergency response plan."""
    plan_id: str = Field(
        default_factory=lambda: f"plan-{uuid4().hex[:8]}",
        validation_alias="id",
        description="Unique plan identifier",
    )
    estimated_response_times: Dict[str, float] = Field(
        default_factory=dict,
        description="Map of incident_id -> estimated minutes until first resource arrives",
    )
    created_at: datetime = Field(default_factory=utc_now, description="UTC timestamp of plan generation")
    updated_at: datetime = Field(default_factory=utc_now, description="UTC timestamp of last plan revision")


# Aliases for general model representation
ResponsePlan = ResponsePlanResponse
PlanResponse = ResponsePlanResponse


