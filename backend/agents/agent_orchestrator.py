"""Agent Orchestrator — AI Phase 1.

Orchestrates the multi-agent emergency response pipeline:
  Incident Input
        ↓
  Incident Assessment Agent (IAA)
        ↓
  Resource Allocation Agent (RAA)
        ↓
  Command & Planning Agent (CPA)
        ↓
  Structured Response Plan
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from agents.base_agent import (
    AgentResult,
    IncidentAssessment,
    ResourceAllocation,
    ResponsePlan,
)
from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.resource_allocation_agent import ResourceAllocationAgent
from agents.command_planning_agent import CommandPlanningAgent


class OrchestrationResult(BaseModel):
    """Complete result returned by the multi-agent orchestrator."""
    pipeline_status: str = "success"
    incident_id: str
    assessment: IncidentAssessment
    allocation: ResourceAllocation
    plan: ResponsePlan
    agent_executions: List[AgentResult] = Field(default_factory=list)


class AgentOrchestrator:
    """Coordinates execution across Assessment, Allocation, and Command Planning agents."""

    def __init__(
        self,
        assessment_agent: Optional[IncidentAssessmentAgent] = None,
        allocation_agent: Optional[ResourceAllocationAgent] = None,
        planning_agent: Optional[CommandPlanningAgent] = None,
    ):
        self.assessment_agent = assessment_agent or IncidentAssessmentAgent()
        self.allocation_agent = allocation_agent or ResourceAllocationAgent()
        self.planning_agent = planning_agent or CommandPlanningAgent()

    def run_pipeline(
        self,
        incident_data: Any,
        candidate_resources: Optional[List[Any]] = None,
    ) -> OrchestrationResult:
        """
        Execute the end-to-end multi-agent pipeline for an incident.

        Args:
            incident_data: Dict or schema containing incident details.
            candidate_resources: Optional available resources pool.

        Returns:
            OrchestrationResult containing all intermediate outputs and final plan.
        """
        executions: List[AgentResult] = []

        # ---------------------------------------------------------------------
        # Step 1: Incident Assessment Agent (IAA)
        # ---------------------------------------------------------------------
        assessment_res = self.assessment_agent.execute(incident_data)
        executions.append(assessment_res)
        if not assessment_res.success or not isinstance(assessment_res.data, IncidentAssessment):
            raise RuntimeError(f"Step 1 (Assessment) failed: {assessment_res.message}")
        assessment: IncidentAssessment = assessment_res.data

        # ---------------------------------------------------------------------
        # Step 2: Resource Allocation Agent (RAA)
        # ---------------------------------------------------------------------
        allocation_input = {
            "assessment": assessment,
            "resources": candidate_resources,
            "incident": incident_data,
        }
        allocation_res = self.allocation_agent.execute(allocation_input)
        executions.append(allocation_res)
        if not allocation_res.success or not isinstance(allocation_res.data, ResourceAllocation):
            raise RuntimeError(f"Step 2 (Allocation) failed: {allocation_res.message}")
        allocation: ResourceAllocation = allocation_res.data

        # ---------------------------------------------------------------------
        # Step 3: Command & Planning Agent (CPA)
        # ---------------------------------------------------------------------
        planning_input = {
            "assessment": assessment,
            "allocation": allocation,
        }
        planning_res = self.planning_agent.execute(planning_input)
        executions.append(planning_res)
        if not planning_res.success or not isinstance(planning_res.data, ResponsePlan):
            raise RuntimeError(f"Step 3 (Planning) failed: {planning_res.message}")
        plan: ResponsePlan = planning_res.data

        incident_id = (
            assessment.incident_id
            or (incident_data.get("incident_id") if isinstance(incident_data, dict) else None)
            or "INC-001"
        )

        return OrchestrationResult(
            pipeline_status="success",
            incident_id=incident_id,
            assessment=assessment,
            allocation=allocation,
            plan=plan,
            agent_executions=executions,
        )


def run_demo_pipeline() -> OrchestrationResult:
    """
    Demo / test function that executes the multi-agent pipeline using seed data.
    """
    # Sample seed incident (Commercial fire in Bengaluru)
    seed_incident = {
        "incident_id": "INC-DEMO-001",
        "title": "Commercial Complex Fire",
        "type": "Building Fire",
        "description": "Multi-storey commercial building fire with heavy smoke. Multiple people trapped on 3rd floor.",
        "location": "Whitefield Main Road, near ITPL Gate 2",
        "latitude": 12.9698,
        "longitude": 77.7500,
        "severity": "critical",
        "urgency": 10,
        "required_resources": ["fire_team", "ambulance", "rescue_team"],
    }

    # Sample seed resources pool
    seed_resources = [
        {
            "id": "FIRE-01",
            "name": "Whitefield Fire Engine 1",
            "type": "fire_team",
            "status": "available",
            "latitude": 12.9720,
            "longitude": 77.7450,
            "capacity": 4,
        },
        {
            "id": "AMB-01",
            "name": "Manipal Emergency Ambulance 1",
            "type": "ambulance",
            "status": "available",
            "latitude": 12.9650,
            "longitude": 77.7400,
            "capacity": 2,
        },
        {
            "id": "RESCUE-01",
            "name": "NDRF SAR Unit 1",
            "type": "rescue_team",
            "status": "available",
            "latitude": 12.9780,
            "longitude": 77.7550,
            "capacity": 6,
        },
        {
            "id": "POLICE-01",
            "name": "Traffic Control Patrol 3",
            "type": "police",
            "status": "available",
            "latitude": 12.9600,
            "longitude": 77.7300,
            "capacity": 2,
        },
    ]

    orchestrator = AgentOrchestrator()
    return orchestrator.run_pipeline(seed_incident, candidate_resources=seed_resources)


if __name__ == "__main__":
    print("=" * 70)
    print("CRISIS COMMAND — MULTI-AGENT FOUNDATION PIPELINE DEMO")
    print("=" * 70)
    result = run_demo_pipeline()
    print(f"\n[1] Incident ID: {result.incident_id}")
    print(f"\n[2] Assessment:")
    print(f"    - Type: {result.assessment.incident_type}")
    print(f"    - Severity: {result.assessment.severity.upper()}")
    print(f"    - Urgency: {result.assessment.urgency}/10")
    print(f"    - Required: {result.assessment.required_resources}")
    print(f"    - Reasoning: {result.assessment.reasoning}")
    print(f"\n[3] Resource Allocation:")
    print(f"    - Status: {result.allocation.allocation_status}")
    print(f"    - Total Allocated: {result.allocation.total_allocated}")
    for a in result.allocation.allocated_resources:
        print(f"      * {a.resource_id} ({a.resource_type}) -> ETA: {a.eta_minutes}m, Dist: {a.distance_km}km")
    print(f"\n[4] Response Plan:")
    print(f"    - Plan ID: {result.plan.plan_id}")
    print(f"    - Status: {result.plan.plan_status.upper()}")
    print(f"    - Attention Required: {result.plan.attention_required}")
    print(f"    - Summary: {result.plan.summary}")
    print("\n" + "=" * 70)
