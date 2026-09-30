"""Human Approval Request data models and schemas (Phase 2)."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import Field, field_validator

from schemas.base import BaseSchema, utc_now
from schemas.enums import ApprovalRequestType, ApprovalStatus


class HumanApprovalRequestBase(BaseSchema):
    """Base fields shared across human approval request representations."""
    type: ApprovalRequestType = Field(..., description="Approval category: resource_reallocation, emergency_dispatch, response_plan_change, manual_override, shortage, etc.")
    description: str = Field(..., min_length=1, description="Concise explanation of the action needing sign-off")
    reason: str = Field(..., min_length=1, description="Operational justification or trigger context")
    impact: Optional[str] = Field(default=None, description="Expected operational or community impact")
    incident_id: Optional[str] = Field(default=None, description="Associated incident ID if applicable")
    resource_id: Optional[str] = Field(default=None, description="Associated resource ID if applicable")
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING, description="Current approval status")

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


class HumanApprovalRequestCreate(HumanApprovalRequestBase):
    """Request schema for creating an approval request."""
    request_id: Optional[str] = Field(default=None, validation_alias="id", description="Optional custom ID")


class HumanApprovalRequestUpdate(BaseSchema):
    """Request schema for resolving or updating an approval request."""
    status: Optional[ApprovalStatus] = Field(default=None, description="Decision: approved or rejected")
    note: Optional[str] = Field(default=None, description="Optional operator comment or reason for decision")
    resolved_by: Optional[str] = Field(default=None, description="Identifier of the resolving operator")
    description: Optional[str] = None
    reason: Optional[str] = None
    impact: Optional[str] = None
    incident_id: Optional[str] = None
    resource_id: Optional[str] = None


class HumanApprovalRequestResponse(HumanApprovalRequestBase):
    """Response schema representing a human approval request."""
    request_id: str = Field(default_factory=lambda: f"appr-{uuid4().hex[:8]}", validation_alias="id", description="Unique request identifier")
    created_at: datetime = Field(default_factory=utc_now, description="UTC timestamp when approval was requested")
    resolved_at: Optional[datetime] = Field(default=None, description="UTC timestamp when approval was resolved")
    note: Optional[str] = Field(default=None, description="Operator note or decision justification")
    resolved_by: Optional[str] = Field(default=None, description="Operator who resolved the approval")


# Aliases for general model representation
HumanApprovalRequest = HumanApprovalRequestResponse
ApprovalRequest = HumanApprovalRequestResponse
Approval = HumanApprovalRequestResponse
