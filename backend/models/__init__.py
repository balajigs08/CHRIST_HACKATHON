"""Data models and schemas for Crisis Command (Phase 2)."""
from models.errors import Conflict, CrisisError, NotFound, OptimizationError

from schemas.alert import (
    Alert,
    AlertBase,
    AlertCreate,
    AlertResponse,
    AlertUpdate,
)
from schemas.approval import (
    Approval,
    ApprovalRequest,
    HumanApprovalRequest,
    HumanApprovalRequestBase,
    HumanApprovalRequestCreate,
    HumanApprovalRequestResponse,
    HumanApprovalRequestUpdate,
)
from schemas.base import BaseSchema, utc_now
from schemas.enums import (
    AlertSeverity,
    AlertStatus,
    ApprovalRequestType,
    ApprovalStatus,
    EventType,
    IncidentSeverity,
    IncidentStatus,
    PlanStatus,
    ResourceStatus,
    ResourceType,
    Severity,
    StrEnum,
)
from schemas.event import AuditLog, Event, EventBase, EventCreate, EventResponse
from schemas.health import HealthResponse
from schemas.incident import (
    Incident,
    IncidentBase,
    IncidentCreate,
    IncidentResponse,
    IncidentUpdate,
)
from schemas.plan import (
    PlanAssignment,
    PlanResponse,
    ResourceAssignment,
    ResponsePlan,
    ResponsePlanBase,
    ResponsePlanCreate,
    ResponsePlanResponse,
    ResponsePlanUpdate,
)
from schemas.resource import (
    Resource,
    ResourceBase,
    ResourceCreate,
    ResourceResponse,
    ResourceUpdate,
)
from schemas.root import RootResponse

__all__ = [
    # Base & Errors
    "BaseSchema",
    "utc_now",
    "CrisisError",
    "NotFound",
    "Conflict",
    "OptimizationError",
    # System
    "HealthResponse",
    "RootResponse",
    # Enums
    "StrEnum",
    "IncidentSeverity",
    "Severity",
    "IncidentStatus",
    "ResourceType",
    "ResourceStatus",
    "PlanStatus",
    "EventType",
    "AlertSeverity",
    "AlertStatus",
    "ApprovalRequestType",
    "ApprovalStatus",
    # Incident
    "Incident",
    "IncidentBase",
    "IncidentCreate",
    "IncidentUpdate",
    "IncidentResponse",
    # Resource
    "Resource",
    "ResourceBase",
    "ResourceCreate",
    "ResourceUpdate",
    "ResourceResponse",
    # Response Plan
    "ResponsePlan",
    "ResponsePlanBase",
    "ResponsePlanCreate",
    "ResponsePlanUpdate",
    "ResponsePlanResponse",
    "ResourceAssignment",
    "PlanAssignment",
    "PlanResponse",
    # Event / Audit Log
    "Event",
    "EventBase",
    "EventCreate",
    "EventResponse",
    "AuditLog",
    # Alert
    "Alert",
    "AlertBase",
    "AlertCreate",
    "AlertUpdate",
    "AlertResponse",
    # Human Approval Request
    "HumanApprovalRequest",
    "HumanApprovalRequestBase",
    "HumanApprovalRequestCreate",
    "HumanApprovalRequestUpdate",
    "HumanApprovalRequestResponse",
    "ApprovalRequest",
    "Approval",
]
