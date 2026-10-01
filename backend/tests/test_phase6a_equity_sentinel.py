"""Unit Tests for AI Phase 6A — Equity + Explainability + Boundary Sentinel."""
from agents.base_agent import (
    IncidentAssessment,
    ResourceAllocation,
    ResourceAssignment,
    ResponsePlan,
)
from agents.command_planning_agent import CommandPlanningAgent, BoundarySentinel
from agents.resource_allocation_agent import ResourceAllocationAgent
from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.agent_orchestrator import run_demo_pipeline
from config import get_settings
from models.schemas import Incident, Resource, ResourceType, Severity
from services.priority_service import PriorityService


def get_priority_service():
    return PriorityService(get_settings())


def get_cpa():
    return CommandPlanningAgent()


def get_raa():
    return ResourceAllocationAgent()


# ---------------------------------------------------------------------------
# 1. Waiting-Time Priority Increase (Equity Calculation)
# ---------------------------------------------------------------------------
def test_waiting_time_equity_priority_increase():
    """Verify that unserved incidents gain priority deterministically over time up to the configured ceiling."""
    prio_service = get_priority_service()

    # Create medium severity incident
    inc = Incident(
        id="INC-WAIT",
        type="Flooding",
        description="Waterlogging on main road",
        latitude=12.9716,
        longitude=77.5946,
        severity=Severity.medium,  # Base: 50.0
        urgency=5,
        required_resources=[ResourceType.rescue_team],
        created_at=__import__("datetime").datetime.utcnow(),
        waiting_time=0.0,
    )

    # 0 min wait: Base = 50.0, Bonus = 0.0
    bd0 = prio_service.breakdown(inc)
    assert bd0["severity_base"] == 50.0
    assert bd0["waiting_bonus"] == 0.0
    assert bd0["effective_priority"] == 50.0

    # 20 min wait: Bonus = 0.5 * 20 = 10.0 -> Total = 60.0
    inc.waiting_time = 20.0
    bd20 = prio_service.breakdown(inc)
    assert bd20["waiting_bonus"] == 10.0
    assert bd20["effective_priority"] == 60.0

    # 70 min wait: Bonus is capped at max_waiting_bonus (30.0) -> Total = 80.0
    inc.waiting_time = 70.0
    bd70 = prio_service.breakdown(inc)
    assert bd70["waiting_bonus"] == 30.0
    assert bd70["effective_priority"] == 80.0


# ---------------------------------------------------------------------------
# 2. Fairness Between Long-Waiting Incident and Newer Incident
# ---------------------------------------------------------------------------
def test_fairness_prevents_starvation_in_pulp():
    """Verify that a long-waiting medium incident gains enough equity priority to claim a contested unit over a fresh incident."""
    raa = get_raa()

    # Incident A: Low severity (Base: 20) but waiting 60 minutes (+30 bonus -> Effective = 50)
    inc_old = {
        "id": "INC-OLD-LOW",
        "severity": "low",
        "urgency": 2,
        "waiting_time": 60.0,  # 20 + 30 = 50.0 priority
        "required_resources": ["ambulance"],
        "latitude": 12.9700,
        "longitude": 77.5900,
    }

    # Incident B: Low severity (Base: 20) freshly reported with 0 wait time (Effective = 20)
    inc_new = {
        "id": "INC-NEW-LOW",
        "severity": "low",
        "urgency": 2,
        "waiting_time": 0.0,  # 20 + 0 = 20.0 priority
        "required_resources": ["ambulance"],
        "latitude": 12.9700,
        "longitude": 77.5900,
    }

    # Only 1 ambulance available
    resources = [
        {"id": "A-SOLO", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9705, "longitude": 77.5905},
    ]

    res = raa.execute({"incidents": [inc_new, inc_old], "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert len(alloc.allocated_resources) == 1

    # Starvation prevention: INC-OLD-LOW must be chosen due to higher equity-adjusted priority
    assert alloc.allocated_resources[0].incident_id == "INC-OLD-LOW"


# ---------------------------------------------------------------------------
# 3. Data-Backed Allocation Explainability
# ---------------------------------------------------------------------------
def test_data_backed_allocation_explainability():
    """Verify that allocation reasoning explicitly documents severity base, waiting time, equity bonus, ETA, and distance."""
    raa = get_raa()
    incident = {
        "incident_id": "INC-EXPLAIN",
        "severity": "high",  # Base 80
        "urgency": 8,
        "waiting_time": 24.0,  # +12 bonus -> 92
        "required_resources": ["ambulance"],
        "latitude": 12.9352,
        "longitude": 77.6245,
    }
    resources = [
        {"id": "A01", "name": "Medic 1", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9360, "longitude": 77.6250},
    ]

    res = raa.execute({"incident": incident, "resources": resources})
    assert res.success is True
    assignment = res.data.allocated_resources[0]

    reason = assignment.reason
    assert "Distance:" in reason or "km" in reason
    assert "ETA:" in reason or "min" in reason
    assert "Priority Breakdown:" in reason
    assert "fairness bonus" in reason
    assert "A01" in reason


# ---------------------------------------------------------------------------
# 4. Boundary Sentinel: Required Capability Exceeds Available Capacity
# ---------------------------------------------------------------------------
def test_sentinel_detects_capacity_shortfall():
    """Verify Boundary Sentinel flags shortage and requires human approval when required units exceed supply."""
    cpa = get_cpa()
    incident = {
        "id": "INC-001",
        "severity": "critical",
        "urgency": 10,
        "required_resources": ["fire_team", "shelter"],
    }
    # Only fire_team is available; shelter is missing
    resources = [
        {"id": "F01", "type": "fire_team", "status": "available", "capabilities": ["fire_suppression"]},
    ]

    plan = cpa.replan("Shortage Event", incidents=[incident], resources=resources)
    assert plan.attention_required is True
    assert plan.human_approval_required is True
    assert plan.plan_status == "requires_attention"
    assert "shelter" in plan.missing_resources
    assert "Capacity Shortfall" in plan.attention_reason


# ---------------------------------------------------------------------------
# 5. Boundary Sentinel: Critical Incident With No Feasible Resource
# ---------------------------------------------------------------------------
def test_sentinel_detects_unassigned_critical_incident():
    """Verify Boundary Sentinel flags zero-coverage on critical life safety incidents."""
    cpa = get_cpa()
    crit_inc = {
        "id": "INC-CRIT-UNASSIGNED",
        "severity": "critical",
        "urgency": 10,
        "required_resources": ["rescue_team"],
    }
    # No rescue teams available at all
    resources = [
        {"id": "A01", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"]},
    ]

    plan = cpa.replan("Critical unassigned", incidents=[crit_inc], resources=resources)
    assert plan.attention_required is True
    assert plan.human_approval_required is True
    assert "INC-CRIT-UNASSIGNED" in plan.unassigned_incidents
    assert "Critical Deficit" in plan.attention_reason


# ---------------------------------------------------------------------------
# 6. Boundary Sentinel: Fleet Exhaustion Detection
# ---------------------------------------------------------------------------
def test_sentinel_detects_fleet_exhaustion():
    """Verify Boundary Sentinel detects when 0 standby units remain for a requested capability."""
    cpa = get_cpa()
    incident = {
        "id": "INC-001",
        "severity": "high",
        "urgency": 8,
        "required_resources": ["ambulance"],
        "latitude": 12.9700,
        "longitude": 77.5900,
    }
    # Exactly 1 ambulance in fleet; once assigned, remaining available standby = 0
    resources = [
        {"id": "A01", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9710, "longitude": 77.5910},
    ]

    plan = cpa.replan("Single ambulance deployment", incidents=[incident], resources=resources)
    # The single ambulance is assigned
    assert len(plan.assignments) == 1
    # Sentinel notices ambulance fleet is now exhausted
    assert "Fleet Exhaustion" in (plan.attention_reason or "") or "ambulance" in str(cpa.audit_log[-1].get("exhausted_types", []))


# ---------------------------------------------------------------------------
# 7. Boundary Sentinel: Excessive Critical Response ETA Hazard
# ---------------------------------------------------------------------------
def test_sentinel_detects_excessive_critical_eta():
    """Verify Boundary Sentinel raises hazard alarm when critical incident ETA exceeds 15 minutes."""
    cpa = get_cpa()
    incident = {
        "id": "INC-FAR-CRIT",
        "severity": "critical",
        "urgency": 10,
        "required_resources": ["ambulance"],
        "latitude": 12.9000,
        "longitude": 77.5000,  # Remote location
    }
    # Only available ambulance is >25 km away (ETA ~35 min)
    resources = [
        {
            "id": "A-VERY-FAR",
            "type": "ambulance",
            "status": "available",
            "capabilities": ["medical_transport"],
            "latitude": 13.1500,
            "longitude": 77.8000,
        },
    ]

    plan = cpa.replan("Remote critical emergency", incidents=[incident], resources=resources)
    assert len(plan.assignments) == 1
    assert plan.assignments[0].eta_minutes > 15.0
    assert plan.attention_required is True
    assert "Excessive ETA Hazard" in plan.attention_reason


# ---------------------------------------------------------------------------
# 8. Never Fabricate Nonexistent or Unavailable Resources
# ---------------------------------------------------------------------------
def test_never_fabricate_unavailable_resources():
    """Verify that when 0 units are available, the system strictly dispatches 0 units and never fabricates phantom resources."""
    cpa = get_cpa()
    incident = {
        "id": "INC-001",
        "severity": "critical",
        "urgency": 10,
        "required_resources": ["fire_team"],
    }
    resources = [
        {"id": "F-BROKEN", "type": "fire_team", "status": "unavailable", "capabilities": ["fire_suppression"]},
        {"id": "F-SHOP", "type": "fire_team", "status": "maintenance", "capabilities": ["fire_suppression"]},
    ]

    plan = cpa.replan("All units down", incidents=[incident], resources=resources)
    assert len(plan.assignments) == 0  # 0 units dispatched
    assert plan.attention_required is True
    assert plan.plan_status == "requires_attention"
    assert "fire_team" in plan.missing_resources


# ---------------------------------------------------------------------------
# 9. Complete End-to-End Pipeline with Equity and Boundary Sentinel
# ---------------------------------------------------------------------------
def test_full_pipeline_with_equity_and_sentinel():
    """Verify entire pipeline: Incident -> IAA -> RAA (Equity+PuLP) -> CPA (Diff+Sentinel) -> ResponsePlan."""
    demo_res = run_demo_pipeline()
    assert demo_res.pipeline_status == "success"
    assert demo_res.plan.plan_id.startswith("PLN-")
    assert len(demo_res.plan.assignments) == 3

    # Check that each assignment has rich data-backed reasoning with priority breakdown
    for a in demo_res.plan.assignments:
        assert len(a.reason) > 30
        assert "Priority Breakdown:" in a.reason or "compatible" in a.reason


if __name__ == "__main__":
    print("Running AI Phase 6A — Equity + Explainability + Boundary Sentinel Tests...")
    test_waiting_time_equity_priority_increase()
    test_fairness_prevents_starvation_in_pulp()
    test_data_backed_allocation_explainability()
    test_sentinel_detects_capacity_shortfall()
    test_sentinel_detects_unassigned_critical_incident()
    test_sentinel_detects_fleet_exhaustion()
    test_sentinel_detects_excessive_critical_eta()
    test_never_fabricate_unavailable_resources()
    test_full_pipeline_with_equity_and_sentinel()
    print("All AI Phase 6A tests passed successfully!")
