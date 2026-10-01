"""Pydantic v2 domain models and request/response schemas."""
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class IncidentStatus(str, Enum):
    pending = "pending"
    assessed = "assessed"
    waiting = "waiting"
    assigned = "assigned"
    active = "active"
    resolved = "resolved"


class ResourceType(str, Enum):
    ambulance = "ambulance"
    fire_team = "fire_team"
    rescue_team = "rescue_team"
    medical_unit = "medical_unit"
    shelter = "shelter"
    police = "police"


class ResourceStatus(str, Enum):
    available = "available"
    assigned = "assigned"
    unavailable = "unavailable"
    maintenance = "maintenance"


class EventType(str, Enum):
    INCIDENT_CREATED = "INCIDENT_CREATED"
    INCIDENT_UPDATED = "INCIDENT_UPDATED"
    INCIDENT_ESCALATED = "INCIDENT_ESCALATED"
    RESOURCE_AVAILABLE = "RESOURCE_AVAILABLE"
    RESOURCE_UNAVAILABLE = "RESOURCE_UNAVAILABLE"
    RESOURCE_UPDATED = "RESOURCE_UPDATED"
    RESOURCE_ASSIGNED = "RESOURCE_ASSIGNED"
    RESOURCE_REALLOCATED = "RESOURCE_REALLOCATED"
    PLAN_RECALCULATED = "PLAN_RECALCULATED"
    HUMAN_APPROVAL_REQUIRED = "HUMAN_APPROVAL_REQUIRED"
    BOUNDARY_COLLAPSE = "BOUNDARY_COLLAPSE"
    APPROVAL_APPROVED = "APPROVAL_APPROVED"
    APPROVAL_REJECTED = "APPROVAL_REJECTED"
    SCENARIO_RESET = "SCENARIO_RESET"
    TIME_ADVANCED = "TIME_ADVANCED"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    superseded = "superseded"


# ---------------------------------------------------------------- core entities
class Incident(BaseModel):
    id: str
    type: str
    description: str
    latitude: float
    longitude: float
    severity: Severity
    urgency: int = Field(ge=1, le=10)
    required_resources: list[ResourceType]
    status: IncidentStatus = IncidentStatus.pending
    created_at: datetime
    waiting_time: float = 0.0  # minutes without any assigned resource
    assigned_resources: list[str] = Field(default_factory=list)
    # derived / informational
    location_name: Optional[str] = None
    reporter_id: Optional[str] = None
    effective_priority: float = 0.0
    missing_resources: list[ResourceType] = Field(default_factory=list)
    assessment_confidence: Optional[float] = None
    assessment_source: Optional[str] = None
    assessment_explanation: Optional[str] = None
    notes: list[str] = Field(default_factory=list)


class Resource(BaseModel):
    id: str
    type: ResourceType
    latitude: float
    longitude: float
    status: ResourceStatus = ResourceStatus.available
    capabilities: list[str] = Field(default_factory=list)
    current_assignment: Optional[str] = None
    available_at: Optional[datetime] = None
    eta: Optional[float] = None  # minutes to current assignment
    status_reason: Optional[str] = None


class Assignment(BaseModel):
    id: str
    incident_id: str
    resource_id: str
    resource_type: ResourceType
    distance: float  # km
    eta: float  # minutes
    status: str = "assigned"
    reason: str
    created_at: datetime


class Event(BaseModel):
    id: str
    event_type: EventType
    timestamp: datetime
    description: str
    affected_entities: list[str] = Field(default_factory=list)
    previous_state: Optional[dict[str, Any]] = None
    new_state: Optional[dict[str, Any]] = None
    reason: Optional[str] = None


class UnassignedIncident(BaseModel):
    incident_id: str
    missing_resources: list[ResourceType]
    no_supply_types: list[ResourceType] = Field(default_factory=list)
    reason: str


class PlanChange(BaseModel):
    kind: str  # assigned | reallocated | released | lost
    resource_id: str
    from_incident: Optional[str] = None
    to_incident: Optional[str] = None
    text: str


class ResponsePlan(BaseModel):
    plan_id: str
    created_at: datetime
    assignments: list[Assignment] = Field(default_factory=list)
    unassigned_incidents: list[UnassignedIncident] = Field(default_factory=list)
    human_approval_required: bool = False
    explanation: str = ""
    objective_value: float = 0.0
    optimization_status: str = "NotRun"
    trigger: str = ""
    changes: list[PlanChange] = Field(default_factory=list)


class PlanHistoryEntry(BaseModel):
    plan_id: str
    created_at: datetime
    trigger: str
    previous: list[dict[str, str]]
    new: list[dict[str, str]]
    changes: list[PlanChange]
    reason: str


class Approval(BaseModel):
    id: str
    plan_id: str
    status: ApprovalStatus = ApprovalStatus.pending
    reason: str
    recommended_action: str
    incident_ids: list[str]
    missing: dict[str, list[str]]
    signature: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    note: Optional[str] = None


# ---------------------------------------------------------------- assessment
class Location(BaseModel):
    latitude: float
    longitude: float
    name: Optional[str] = None


class AssessmentResult(BaseModel):
    incident_type: str
    severity: Severity
    urgency: int = Field(ge=1, le=10)
    location: Location
    required_resources: list[ResourceType]
    confidence: float = Field(ge=0, le=1)
    explanation: str
    source: str = "rules"


# ---------------------------------------------------------------- requests
class AssessRequest(BaseModel):
    text: str = Field(min_length=3)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class IncidentCreate(BaseModel):
    description: str = Field(min_length=3)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    # optional operator overrides (otherwise the assessment agent decides)
    type: Optional[str] = None
    severity: Optional[Severity] = None
    urgency: Optional[int] = Field(default=None, ge=1, le=10)
    required_resources: Optional[list[ResourceType]] = None


class IncidentUpdate(BaseModel):
    description: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    severity: Optional[Severity] = None
    urgency: Optional[int] = Field(default=None, ge=1, le=10)
    required_resources: Optional[list[ResourceType]] = None
    status: Optional[IncidentStatus] = None


class ResourceCreate(BaseModel):
    id: Optional[str] = None
    type: ResourceType
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    status: ResourceStatus = ResourceStatus.available
    capabilities: Optional[list[str]] = None


class ResourceUpdate(BaseModel):
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    status: Optional[ResourceStatus] = None
    capabilities: Optional[list[str]] = None
    reason: Optional[str] = None


class ResourceUnavailableRequest(BaseModel):
    resource_id: str
    reason: str = "Reported unavailable"


class ResourceAvailableRequest(BaseModel):
    resource_id: str


class ApprovalDecision(BaseModel):
    approval_id: Optional[str] = None
    note: Optional[str] = None


class AdvanceRequest(BaseModel):
    minutes: float = Field(default=10, gt=0, le=1440)


class SimIncidentRequest(BaseModel):
    kind: str  # road_accident | medical_emergency | building_fire | critical
