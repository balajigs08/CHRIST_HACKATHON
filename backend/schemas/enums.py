"""Domain Enumerations for Crisis Command (Phase 2)."""
from enum import Enum


class StrEnum(str, Enum):
    """String enum with case-insensitive matching and serialization compatibility."""
    def __str__(self) -> str:
        return self.value

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            val_norm = value.strip().lower()
            for member in cls:
                if member.value.lower() == val_norm or member.name.lower() == val_norm:
                    return member
        return None


class IncidentSeverity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


Severity = IncidentSeverity  # Compatibility alias


class IncidentStatus(StrEnum):
    REPORTED = "reported"
    PENDING = "pending"
    ASSESSED = "assessed"
    WAITING = "waiting"
    ASSIGNED = "assigned"
    DISPATCHED = "dispatched"
    IN_PROGRESS = "in_progress"
    ACTIVE = "active"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ResourceType(StrEnum):
    AMBULANCE = "ambulance"
    FIRE_TEAM = "fire_team"
    RESCUE_TEAM = "rescue_team"
    MEDICAL_UNIT = "medical_unit"
    SHELTER = "shelter"
    POLICE = "police"


class ResourceStatus(StrEnum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    DISPATCHED = "dispatched"
    ON_SCENE = "on_scene"
    UNAVAILABLE = "unavailable"
    MAINTENANCE = "maintenance"


class PlanStatus(StrEnum):
    DRAFT = "draft"
    PENDING = "pending"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ACTIVE = "active"
    UPDATED = "updated"
    REQUIRES_ATTENTION = "requires_attention"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    SUPERSEDED = "superseded"


class EventType(StrEnum):
    INCIDENT_REPORTED = "incident_reported"
    INCIDENT_CREATED = "incident_created"
    INCIDENT_ASSESSED = "incident_assessed"
    INCIDENT_UPDATED = "incident_updated"
    INCIDENT_ESCALATED = "incident_escalated"
    PLAN_CREATED = "plan_created"
    RESOURCE_STATUS_CHANGED = "resource_status_changed"
    RESOURCE_ASSIGNED = "resource_assigned"
    RESOURCE_RELEASED = "resource_released"
    RESOURCE_AVAILABLE = "resource_available"
    RESOURCE_UNAVAILABLE = "resource_unavailable"
    RESOURCE_REALLOCATED = "resource_reallocated"
    RESOURCE_UPDATED = "resource_updated"
    PLAN_GENERATED = "plan_generated"
    PLAN_UPDATED = "plan_updated"
    PLAN_RECALCULATED = "plan_recalculated"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_RESOLVED = "approval_resolved"
    APPROVAL_APPROVED = "approval_approved"
    APPROVAL_REJECTED = "approval_rejected"
    ALERT_TRIGGERED = "alert_triggered"
    ALERT_RESOLVED = "alert_resolved"
    HUMAN_APPROVAL_REQUIRED = "human_approval_required"
    BOUNDARY_COLLAPSE = "boundary_collapse"
    SCENARIO_RESET = "scenario_reset"
    TIME_ADVANCED = "time_advanced"
    SYSTEM_INFO = "system_info"


class AlertSeverity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class AlertStatus(StrEnum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class ApprovalRequestType(StrEnum):
    SHORTAGE = "shortage"
    REALLOCATION = "reallocation"
    OVERRIDE = "override"
    ESCALATION = "escalation"
    RESOURCE_REALLOCATION = "resource_reallocation"
    EMERGENCY_DISPATCH = "emergency_dispatch"
    RESPONSE_PLAN_CHANGE = "response_plan_change"
    MANUAL_OVERRIDE = "manual_override"


class ApprovalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"

