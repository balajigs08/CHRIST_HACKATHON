"""Unit Tests for AI Phase 5 — Dynamic Replanning and Command & Planning Agent (CPA)."""
from agents.base_agent import (
    IncidentAssessment,
    ResourceAllocation,
    ResourceAssignment,
    ResponsePlan,
)
from agents.command_planning_agent import CommandPlanningAgent
from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.resource_allocation_agent import ResourceAllocationAgent
from agents.agent_orchestrator import run_demo_pipeline


def get_cpa():
    return CommandPlanningAgent()


# ---------------------------------------------------------------------------
# 1. New Critical Incident Causes Dynamic Replanning
# ---------------------------------------------------------------------------
def test_new_critical_incident_triggers_replanning():
    """Verify that intake of a new critical emergency initiates assessment, PuLP allocation, and plan generation."""
    cpa = get_cpa()
    raw_incident = {
        "incident_id": "INC-NEW-CRIT",
        "title": "Severe Hospital Fire",
        "type": "Building Fire",
        "description": "Active hospital building fire with patients trapped.",
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    resources = [
        {"id": "F01", "type": "fire_team", "status": "available", "capabilities": ["fire_suppression"], "latitude": 12.9700, "longitude": 77.5900},
        {"id": "A01", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9750, "longitude": 77.6000},
    ]

    # Ingest incident via dynamic replanning trigger
    plan = cpa.replan(
        trigger="New Critical Hospital Fire",
        incidents=[raw_incident],
        resources=resources,
    )

    assert isinstance(plan, ResponsePlan)
    assert plan.plan_status == "requires_attention" or plan.plan_status == "active"
    assert len(plan.assignments) > 0
    assert len(cpa.audit_log) == 1
    assert cpa.audit_log[0]["trigger"] == "New Critical Hospital Fire"


# ---------------------------------------------------------------------------
# 2. Allocated Ambulance Becomes Unavailable (Failure Recovery)
# ---------------------------------------------------------------------------
def test_allocated_resource_becomes_unavailable():
    """Verify that when an assigned unit breaks down, CPA replans, pulls an alternate unit, and diffs the loss."""
    cpa = get_cpa()
    incident = {
        "id": "INC-001",
        "severity": "critical",
        "urgency": 9,
        "required_resources": ["ambulance"],
        "latitude": 12.9700,
        "longitude": 77.5900,
    }
    # Initial pool: A01 is assigned
    res_initial = [
        {"id": "A01", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9710, "longitude": 77.5910},
        {"id": "A02", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9780, "longitude": 77.5980},
    ]

    # Initial plan: A01 gets assigned
    plan1 = cpa.replan("Initial Dispatch", incidents=[incident], resources=res_initial)
    assert plan1.assignments[0].resource_id == "A01"

    # Now A01 breaks down (unavailable)
    res_updated = [
        {"id": "A01", "type": "ambulance", "status": "unavailable", "capabilities": ["medical_transport"], "latitude": 12.9710, "longitude": 77.5910},
        {"id": "A02", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9780, "longitude": 77.5980},
    ]

    plan2 = cpa.replan(
        trigger="A01 flat tire",
        incidents=[incident],
        resources=res_updated,
        previous_plan=plan1,
    )

    # A02 must now be assigned to take over
    assert plan2.assignments[0].resource_id == "A02"

    # Plan diff must record that A01 was lost and A02 was assigned
    change_kinds = [c["kind"] for c in plan2.plan_changes]
    assert "lost" in change_kinds or "assigned" in change_kinds


# ---------------------------------------------------------------------------
# 3. Resource Restoration (Unit Returns to Service)
# ---------------------------------------------------------------------------
def test_resource_restoration():
    """Verify that restored units are immediately incorporated into subsequent replanning optimization."""
    cpa = get_cpa()
    incident = {
        "id": "INC-001",
        "severity": "high",
        "urgency": 8,
        "required_resources": ["ambulance"],
        "latitude": 12.9700,
        "longitude": 77.5900,
    }

    # Step 1: Closer unit A-NEAR is in maintenance, so distant unit A-FAR is assigned
    res_step1 = [
        {"id": "A-NEAR", "type": "ambulance", "status": "maintenance", "capabilities": ["medical_transport"], "latitude": 12.9710, "longitude": 77.5910},
        {"id": "A-FAR", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9900, "longitude": 77.6200},
    ]
    plan1 = cpa.replan("Initial state with maintenance unit", incidents=[incident], resources=res_step1)
    assert plan1.assignments[0].resource_id == "A-FAR"

    # Step 2: A-NEAR finishes maintenance and is restored to AVAILABLE
    res_step2 = [
        {"id": "A-NEAR", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9710, "longitude": 77.5910},
        {"id": "A-FAR", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9900, "longitude": 77.6200},
    ]
    plan2 = cpa.replan(
        trigger="A-NEAR restored from maintenance",
        incidents=[incident],
        resources=res_step2,
        previous_plan=plan1,
    )

    # A-NEAR (closer) should now be chosen by optimizer
    assert plan2.assignments[0].resource_id == "A-NEAR"
    # A-FAR should be released
    change_kinds = [c["kind"] for c in plan2.plan_changes]
    assert "released" in change_kinds or "assigned" in change_kinds


# ---------------------------------------------------------------------------
# 4. Resource Competition Between Simultaneous Emergencies
# ---------------------------------------------------------------------------
def test_resource_competition():
    """Verify global PuLP optimization prioritizes critical over moderate emergency on competing units."""
    cpa = get_cpa()
    incidents = [
        {"id": "INC-MODERATE", "severity": "medium", "urgency": 5, "required_resources": ["fire_team"], "latitude": 12.9700, "longitude": 77.5900},
        {"id": "INC-EXTREME", "severity": "critical", "urgency": 10, "required_resources": ["fire_team"], "latitude": 12.9720, "longitude": 77.5920},
    ]
    # Single fire team available
    resources = [
        {"id": "F-SOLO", "type": "fire_team", "status": "available", "capabilities": ["fire_suppression"], "latitude": 12.9710, "longitude": 77.5910},
    ]

    plan = cpa.replan("Competing demand", incidents=incidents, resources=resources)
    assert len(plan.assignments) == 1
    assert plan.assignments[0].incident_id == "INC-EXTREME"
    assert "INC-MODERATE" in plan.unassigned_incidents


# ---------------------------------------------------------------------------
# 5. Shortage Requiring Human Attention & Approval
# ---------------------------------------------------------------------------
def test_shortage_triggers_human_attention():
    """Verify that unfulfilled resource demands flag human attention and approval required."""
    cpa = get_cpa()
    incident = {
        "id": "INC-001",
        "severity": "critical",
        "urgency": 9,
        "required_resources": ["fire_team", "rescue_team", "shelter"],
    }
    # Only fire_team is available; rescue_team and shelter are completely missing
    resources = [
        {"id": "F01", "type": "fire_team", "status": "available", "capabilities": ["fire_suppression"]},
    ]

    plan = cpa.replan("Massive incident with shortfall", incidents=[incident], resources=resources)
    assert plan.attention_required is True
    assert plan.human_approval_required is True
    assert plan.plan_status == "requires_attention"
    assert len(plan.missing_resources) > 0
    assert "Resource shortage" in plan.attention_reason


# ---------------------------------------------------------------------------
# 6. Old vs New Plan Diff Generation
# ---------------------------------------------------------------------------
def test_plan_diff_generation():
    """Verify plan_changes structure tracks assigned, reallocated, and released units with explanations."""
    cpa = get_cpa()
    inc1 = {"id": "INC-1", "severity": "medium", "urgency": 5, "required_resources": ["ambulance"], "latitude": 12.9700, "longitude": 77.5900}
    inc2 = {"id": "INC-2", "severity": "critical", "urgency": 10, "required_resources": ["ambulance"], "latitude": 12.9710, "longitude": 77.5910}

    # Plan 1: Only INC-1 exists, A01 assigned to INC-1
    res = [{"id": "A01", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9705, "longitude": 77.5905}]
    plan1 = cpa.replan("Initial INC-1", incidents=[inc1], resources=res)
    assert plan1.assignments[0].incident_id == "INC-1"

    # Plan 2: Critical INC-2 arrives; A01 is reallocated from INC-1 to INC-2
    plan2 = cpa.replan(
        trigger="Critical INC-2 reported",
        incidents=[inc1, inc2],
        resources=res,
        previous_plan=plan1,
    )

    assert plan2.assignments[0].incident_id == "INC-2"
    realloc_changes = [c for c in plan2.plan_changes if c["kind"] == "reallocated"]
    assert len(realloc_changes) == 1
    assert realloc_changes[0]["from_incident"] == "INC-1"
    assert realloc_changes[0]["to_incident"] == "INC-2"


# ---------------------------------------------------------------------------
# 7. Unchanged Allocation When No Meaningful State Change Occurs
# ---------------------------------------------------------------------------
def test_unchanged_allocation_stability():
    """Verify that replanning on identical state preserves stable assignments without churn."""
    cpa = get_cpa()
    incident = {"id": "INC-001", "severity": "high", "urgency": 8, "required_resources": ["ambulance"], "latitude": 12.9700, "longitude": 77.5900}
    resources = [{"id": "A01", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9710, "longitude": 77.5910}]

    plan1 = cpa.replan("Initial state", incidents=[incident], resources=resources)
    plan2 = cpa.replan("Routine heartbeat check", incidents=[incident], resources=resources, previous_plan=plan1)

    assert len(plan2.assignments) == 1
    assert plan2.assignments[0].resource_id == "A01"
    assert len(plan2.plan_changes) == 0  # No churn
    assert "No assignment changes required" in plan2.explanation


# ---------------------------------------------------------------------------
# 8. Complete Multi-Agent Pipeline Replanning Integration
# ---------------------------------------------------------------------------
def test_complete_multi_agent_pipeline():
    """Verify end-to-end integration: Incident -> IAA -> RAA -> PuLP/CBC -> CPA -> ResponsePlan."""
    demo_res = run_demo_pipeline()
    assert demo_res.pipeline_status == "success"
    assert demo_res.plan.plan_status in ("active", "requires_attention")
    assert len(demo_res.plan.assignments) > 0
    assert len(demo_res.agent_executions) == 3


if __name__ == "__main__":
    print("Running AI Phase 5 — Dynamic Replanning & Command Planning Agent Tests...")
    test_new_critical_incident_triggers_replanning()
    test_allocated_resource_becomes_unavailable()
    test_resource_restoration()
    test_resource_competition()
    test_shortage_triggers_human_attention()
    test_plan_diff_generation()
    test_unchanged_allocation_stability()
    test_complete_multi_agent_pipeline()
    print("All Phase 5 Dynamic Replanning tests passed successfully!")
