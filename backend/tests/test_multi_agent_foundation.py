"""Tests for AI Phase 1 — Multi-Agent Foundation."""
from agents.base_agent import (
    AgentResult,
    BaseAgent,
    IncidentAssessment,
    ResourceAllocation,
    ResourceAssignment,
    ResponsePlan,
)
from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.resource_allocation_agent import ResourceAllocationAgent
from agents.command_planning_agent import CommandPlanningAgent
from agents.agent_orchestrator import AgentOrchestrator, OrchestrationResult, run_demo_pipeline


def test_agent_modules_import():
    """Verify all agent modules and schemas import successfully."""
    assert BaseAgent is not None
    assert IncidentAssessmentAgent is not None
    assert ResourceAllocationAgent is not None
    assert CommandPlanningAgent is not None
    assert AgentOrchestrator is not None


def test_incident_assessment_agent_execution():
    """Verify Incident Assessment Agent produces valid structured assessment."""
    iaa = IncidentAssessmentAgent()
    sample_incident = {
        "incident_id": "INC-TEST-001",
        "title": "Severe Structure Fire",
        "description": "Commercial building on fire with multiple people trapped.",
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    result = iaa.execute(sample_incident)
    assert result.success is True
    assert isinstance(result.data, IncidentAssessment)
    assert result.data.severity in ("critical", "high", "medium", "low")
    assert 1 <= result.data.urgency <= 10
    assert len(result.data.required_resources) > 0
    assert result.data.reasoning != ""


def test_resource_allocation_agent_execution():
    """Verify Resource Allocation Agent produces valid structured allocation."""
    raa = ResourceAllocationAgent()
    assessment = IncidentAssessment(
        incident_id="INC-TEST-002",
        incident_type="Building Fire",
        severity="critical",
        urgency=10,
        required_resources=["fire_team", "ambulance"],
        reasoning="Life safety priority fire.",
        location={"latitude": 12.9716, "longitude": 77.5946},
    )
    resources = [
        {"id": "F01", "name": "Engine 1", "type": "fire_team", "status": "available", "latitude": 12.9700, "longitude": 77.5900},
        {"id": "A01", "name": "Medic 1", "type": "ambulance", "status": "available", "latitude": 12.9750, "longitude": 77.6000},
    ]
    result = raa.execute({"assessment": assessment, "resources": resources})
    assert result.success is True
    assert isinstance(result.data, ResourceAllocation)
    assert result.data.allocation_status == "fully_allocated"
    assert len(result.data.allocated_resources) == 2
    assert len(result.data.unallocated_resource_types) == 0


def test_command_planning_agent_execution():
    """Verify Command & Planning Agent generates valid ResponsePlan."""
    cpa = CommandPlanningAgent()
    assessment = IncidentAssessment(
        incident_id="INC-TEST-003",
        incident_type="Medical Emergency",
        severity="critical",
        urgency=9,
        required_resources=["ambulance"],
        reasoning="Cardiac event",
    )
    allocation = ResourceAllocation(
        incident_id="INC-TEST-003",
        allocated_resources=[
            ResourceAssignment(
                resource_id="A01",
                resource_type="ambulance",
                resource_name="Medic 1",
                incident_id="INC-TEST-003",
                eta_minutes=5.2,
                distance_km=2.4,
            )
        ],
        unallocated_resource_types=[],
        allocation_status="fully_allocated",
        reasoning="Unit assigned",
        total_allocated=1,
    )
    result = cpa.execute({"assessment": assessment, "allocation": allocation})
    assert result.success is True
    assert isinstance(result.data, ResponsePlan)
    assert result.data.plan_id.startswith("PLAN-")
    assert result.data.plan_status == "active"
    assert result.data.attention_required is False
    assert len(result.data.assignments) == 1


def test_agent_orchestrator_pipeline():
    """Verify end-to-end multi-agent orchestration pipeline."""
    result = run_demo_pipeline()
    assert isinstance(result, OrchestrationResult)
    assert result.pipeline_status == "success"
    assert result.assessment.incident_id == "INC-DEMO-001"
    assert len(result.allocation.allocated_resources) > 0
    assert result.plan.plan_status in ("active", "requires_attention")
    assert len(result.agent_executions) == 3


if __name__ == "__main__":
    print("Running Multi-Agent Foundation Tests...")
    test_agent_modules_import()
    test_incident_assessment_agent_execution()
    test_resource_allocation_agent_execution()
    test_command_planning_agent_execution()
    test_agent_orchestrator_pipeline()
    print("All tests passed successfully!")
