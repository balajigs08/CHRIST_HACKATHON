"""Phase 2 Data Models & Pydantic Schemas Test Suite."""
from datetime import datetime
import pytest
from pydantic import ValidationError

from schemas import (
    Alert,
    AlertCreate,
    AlertResponse,
    AlertSeverity,
    AlertStatus,
    AlertUpdate,
    ApprovalRequestType,
    ApprovalStatus,
    AuditLog,
    Event,
    EventCreate,
    EventResponse,
    EventType,
    HumanApprovalRequest,
    HumanApprovalRequestCreate,
    HumanApprovalRequestResponse,
    HumanApprovalRequestUpdate,
    Incident,
    IncidentCreate,
    IncidentResponse,
    IncidentSeverity,
    IncidentStatus,
    IncidentUpdate,
    PlanAssignment,
    PlanStatus,
    Resource,
    ResourceAssignment,
    ResourceCreate,
    ResourceResponse,
    ResourceStatus,
    ResourceType,
    ResourceUpdate,
    ResponsePlan,
    ResponsePlanCreate,
    ResponsePlanResponse,
    ResponsePlanUpdate,
)


# =============================================================================
# 1. Incident Tests
# =============================================================================
def test_incident_creation_and_defaults():
    inc = Incident(
        type="Fire",
        description="Warehouse fire with heavy smoke",
        location="Indiranagar 100ft Road",
        latitude=12.9784,
        longitude=77.6408,
        severity="critical",
        urgency=9,
        required_resources=["fire_team", "ambulance"],
    )
    assert inc.incident_id.startswith("inc-")
    assert inc.type == "Fire"
    assert inc.description == "Warehouse fire with heavy smoke"
    assert inc.location == "Indiranagar 100ft Road"
    assert inc.latitude == 12.9784
    assert inc.longitude == 77.6408
    assert inc.severity == IncidentSeverity.CRITICAL
    assert inc.urgency == 9
    assert inc.status == IncidentStatus.REPORTED
    assert inc.required_resources == [ResourceType.FIRE_TEAM, ResourceType.AMBULANCE]
    assert isinstance(inc.created_at, datetime)
    assert isinstance(inc.updated_at, datetime)


def test_incident_case_insensitivity():
    inc = Incident(
        incident_id="INC-TEST-01",
        type="Medical Emergency",
        description="Cardiac arrest",
        location="MG Road Metro",
        latitude=12.9756,
        longitude=77.6066,
        severity="HIGH",
        urgency=8,
        status="DISPATCHED",
        required_resources=["AMBULANCE"],
    )
    assert inc.severity == IncidentSeverity.HIGH
    assert inc.status == IncidentStatus.DISPATCHED
    assert inc.required_resources == [ResourceType.AMBULANCE]


def test_incident_validation_bounds():
    # Latitude out of bounds
    with pytest.raises(ValidationError):
        Incident(
            type="Collapse",
            description="Bridge collapse",
            location="Outer Ring Road",
            latitude=95.0,  # Invalid
            longitude=77.0,
            severity="critical",
            urgency=10,
        )

    # Longitude out of bounds
    with pytest.raises(ValidationError):
        Incident(
            type="Collapse",
            description="Bridge collapse",
            location="Outer Ring Road",
            latitude=12.0,
            longitude=-185.0,  # Invalid
            severity="critical",
            urgency=10,
        )

    # Urgency out of range
    with pytest.raises(ValidationError):
        Incident(
            type="Collapse",
            description="Bridge collapse",
            location="Outer Ring Road",
            latitude=12.0,
            longitude=77.0,
            severity="critical",
            urgency=11,  # Invalid > 10
        )

    # Invalid severity
    with pytest.raises(ValidationError):
        Incident(
            type="Collapse",
            description="Bridge collapse",
            location="Outer Ring Road",
            latitude=12.0,
            longitude=77.0,
            severity="apocalyptic",  # Invalid
            urgency=5,
        )


def test_incident_request_schemas():
    create_req = IncidentCreate(
        type="Flood",
        description="Street submerged",
        location="Silk Board Junction",
        latitude=12.9176,
        longitude=77.6238,
        severity="medium",
        urgency=5,
    )
    assert create_req.incident_id is None
    dumped = create_req.model_dump()
    assert dumped["type"] == "Flood"

    update_req = IncidentUpdate(status=IncidentStatus.RESOLVED)
    assert update_req.status == IncidentStatus.RESOLVED
    assert update_req.description is None


# =============================================================================
# 2. Resource Tests
# =============================================================================
def test_resource_creation_and_defaults():
    res = Resource(
        type="ambulance",
        location="Koramangala Station 4",
        latitude=12.9352,
        longitude=77.6245,
    )
    assert res.resource_id.startswith("res-")
    assert res.type == ResourceType.AMBULANCE
    assert res.location == "Koramangala Station 4"
    assert res.latitude == 12.9352
    assert res.longitude == 77.6245
    assert res.status == ResourceStatus.AVAILABLE
    assert res.assigned_incident_id is None
    assert res.availability is True
    assert isinstance(res.updated_at, datetime)


def test_resource_case_insensitivity_and_assignment():
    res = Resource(
        resource_id="RES-AMB-01",
        type="RESCUE_TEAM",
        location="Hebbal Flyover Depot",
        latitude=13.0358,
        longitude=77.5970,
        status="ASSIGNED",
        assigned_incident_id="INC-101",
        availability=False,
    )
    assert res.type == ResourceType.RESCUE_TEAM
    assert res.status == ResourceStatus.ASSIGNED
    assert res.assigned_incident_id == "INC-101"
    assert res.availability is False


def test_resource_validation():
    # Invalid resource type
    with pytest.raises(ValidationError):
        Resource(
            type="spaceship",
            location="HQ",
            latitude=12.0,
            longitude=77.0,
        )

    # Invalid latitude
    with pytest.raises(ValidationError):
        Resource(
            type="ambulance",
            location="HQ",
            latitude=-95.0,
            longitude=77.0,
        )


def test_resource_update_schema():
    up = ResourceUpdate(status=ResourceStatus.MAINTENANCE, availability=False)
    assert up.status == ResourceStatus.MAINTENANCE
    assert up.availability is False


# =============================================================================
# 3. Response Plan Tests
# =============================================================================
def test_response_plan_creation():
    asgn1 = ResourceAssignment(
        incident_id="inc-1",
        resource_id="res-1",
        role="Lead Medical Unit",
        eta_minutes=12.5,
    )
    assert asgn1.assignment_id.startswith("asgn-")
    assert asgn1.eta_minutes == 12.5

    plan = ResponsePlan(
        status="draft",
        incident_ids=["inc-1", "inc-2"],
        resource_assignments=[asgn1],
    )
    assert plan.plan_id.startswith("plan-")
    assert plan.status == PlanStatus.DRAFT
    assert plan.incident_ids == ["inc-1", "inc-2"]
    assert len(plan.resource_assignments) == 1
    assert plan.resource_assignments[0].incident_id == "inc-1"
    assert isinstance(plan.created_at, datetime)
    assert isinstance(plan.updated_at, datetime)


def test_response_plan_assignment_alias():
    # Verify backward compatibility with 'assignments' alias
    plan = ResponsePlan(
        status=PlanStatus.APPROVED,
        incident_ids=["inc-10"],
        assignments=[
            {"incident_id": "inc-10", "resource_id": "res-20", "role": "Primary"}
        ],
    )
    assert len(plan.resource_assignments) == 1
    assert plan.resource_assignments[0].resource_id == "res-20"


def test_response_plan_update():
    up = ResponsePlanUpdate(status=PlanStatus.COMPLETED)
    assert up.status == PlanStatus.COMPLETED


# =============================================================================
# 4. Event / Audit Log Tests
# =============================================================================
def test_event_creation_and_defaults():
    evt = Event(
        event_type="incident_reported",
        description="Caller reported multi-vehicle crash on Hosur Road",
        incident_id="inc-501",
        actor="caller_gateway",
    )
    assert evt.event_id.startswith("evt-")
    assert evt.event_type == EventType.INCIDENT_REPORTED
    assert evt.description == "Caller reported multi-vehicle crash on Hosur Road"
    assert evt.incident_id == "inc-501"
    assert evt.resource_id is None
    assert evt.actor == "caller_gateway"
    assert isinstance(evt.timestamp, datetime)


def test_audit_log_alias_and_normalization():
    log = AuditLog(
        event_type="RESOURCE_ASSIGNED",
        description="Ambulance A01 assigned to incident INC-12",
        incident_id="INC-12",
        resource_id="A01",
    )
    assert log.event_type == EventType.RESOURCE_ASSIGNED
    assert log.actor == "system"


def test_event_validation():
    with pytest.raises(ValidationError):
        Event(
            event_type="unknown_event_xyz",
            description="Testing invalid",
        )


# =============================================================================
# 5. Alert Tests
# =============================================================================
def test_alert_creation_and_defaults():
    alt = Alert(
        title="Ambulance Shortage",
        description="All tier-1 ambulances in East Zone are currently deployed",
        severity="high",
        incident_id="inc-88",
    )
    assert alt.alert_id.startswith("alt-")
    assert alt.title == "Ambulance Shortage"
    assert alt.severity == AlertSeverity.HIGH
    assert alt.status == AlertStatus.ACTIVE
    assert alt.requires_human_attention is True
    assert isinstance(alt.created_at, datetime)


def test_alert_case_insensitivity_and_resolution():
    alt = Alert(
        alert_id="ALT-100",
        title="Critical Hazard",
        description="Gas pipeline leakage detected near residential zone",
        severity="CRITICAL",
        status="ACKNOWLEDGED",
        requires_human_attention=True,
    )
    assert alt.severity == AlertSeverity.CRITICAL
    assert alt.status == AlertStatus.ACKNOWLEDGED


def test_alert_validation():
    with pytest.raises(ValidationError):
        Alert(
            title="Invalid",
            description="Testing",
            severity="extreme_danger",  # Invalid
        )


def test_alert_update():
    up = AlertUpdate(status=AlertStatus.RESOLVED, requires_human_attention=False)
    assert up.status == AlertStatus.RESOLVED
    assert up.requires_human_attention is False


# =============================================================================
# 6. Human Approval Request Tests
# =============================================================================
def test_approval_request_creation_and_defaults():
    req = HumanApprovalRequest(
        type="reallocation",
        description="Reallocate Ambulance AMB-04 from low-severity to critical incident",
        reason="Priority escalation: cardiac patient requires immediate advanced life support",
    )
    assert req.request_id.startswith("appr-")
    assert req.type == ApprovalRequestType.REALLOCATION
    assert req.status == ApprovalStatus.PENDING
    assert isinstance(req.created_at, datetime)
    assert req.resolved_at is None


def test_approval_request_case_insensitivity_and_resolution():
    now = datetime.now()
    req = HumanApprovalRequest(
        request_id="REQ-APP-09",
        type="SHORTAGE",
        description="Request mutual aid from neighboring district",
        reason="Exhausted all available heavy rescue teams",
        status="APPROVED",
        resolved_at=now,
    )
    assert req.type == ApprovalRequestType.SHORTAGE
    assert req.status == ApprovalStatus.APPROVED
    assert req.resolved_at == now


def test_approval_request_validation():
    with pytest.raises(ValidationError):
        HumanApprovalRequest(
            type="unauthorized_action",  # Invalid
            description="Testing",
            reason="Testing",
        )


def test_approval_update():
    up = HumanApprovalRequestUpdate(
        status=ApprovalStatus.APPROVED,
        note="Approved by Incident Commander Sharma",
        resolved_by="commander_sharma",
    )
    assert up.status == ApprovalStatus.APPROVED
    assert up.note == "Approved by Incident Commander Sharma"
    assert up.resolved_by == "commander_sharma"
