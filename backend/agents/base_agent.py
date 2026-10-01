"""AI Multi-Agent Foundation — Base Agent & Communication Models (AI Phase 1).

Provides:
- BaseAgent: Common abstract base class for all Crisis Command agents.
- IncidentAssessment: Structured output from the Incident Assessment Agent.
- ResourceAssignment: Single resource-to-incident allocation record.
- ResourceAllocation: Structured output from the Resource Allocation Agent.
- ResponsePlan: Structured output from the Command & Planning Agent.
- AgentResult: Generic standardized wrapper for all agent execution results.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Structured Communication Models (Pydantic)
# ---------------------------------------------------------------------------

class AgentResult(BaseModel):
    """Standardized wrapper returned by all agents after execution."""
    agent_name: str
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None
    errors: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        arbitrary_types_allowed = True


class IncidentAssessment(BaseModel):
    """Structured assessment produced by Incident Assessment Agent (IAA)."""
    incident_id: Optional[str] = None
    incident_type: str
    severity: str  # "critical" | "high" | "medium" | "low"
    urgency: int = Field(ge=1, le=10)  # scale 1-10
    required_resources: List[str] = Field(default_factory=list)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    reasoning: str
    location: Optional[Dict[str, Any]] = None
    waiting_time_minutes: Optional[float] = 0.0
    assessed_at: datetime = Field(default_factory=datetime.utcnow)


class ResourceAssignment(BaseModel):
    """Individual unit assignment record within an allocation."""
    resource_id: str
    resource_type: str
    resource_name: Optional[str] = None
    incident_id: str
    status: str = "assigned"
    eta_minutes: float = 0.0
    distance_km: float = 0.0
    reason: str = "Matched required resource capability and availability."


class ResourceAllocation(BaseModel):
    """Structured allocation outcome produced by Resource Allocation Agent (RAA)."""
    incident_id: str
    allocated_resources: List[ResourceAssignment] = Field(default_factory=list)
    unallocated_resource_types: List[str] = Field(default_factory=list)
    missing_resources: List[str] = Field(default_factory=list)
    unassigned_incidents: List[str] = Field(default_factory=list)
    allocations_by_incident: Dict[str, Any] = Field(default_factory=dict)
    allocation_status: str = "allocated"  # "fully_allocated" | "partially_allocated" | "unallocated"
    reasoning: str
    total_allocated: int = 0
    allocated_at: datetime = Field(default_factory=datetime.utcnow)


class ResponsePlan(BaseModel):
    """Structured operational response plan produced by Command & Planning Agent (CPA)."""
    plan_id: str
    incident_id: str = "ALL"
    plan_status: str = "active"  # "pending" | "active" | "requires_attention" | "completed"
    assignments: List[ResourceAssignment] = Field(default_factory=list)
    estimated_response: Dict[str, Any] = Field(default_factory=dict)
    attention_required: bool = False
    attention_reason: Optional[str] = None
    human_approval_required: bool = False
    plan_changes: List[Dict[str, Any]] = Field(default_factory=list)
    unassigned_incidents: List[str] = Field(default_factory=list)
    missing_resources: List[str] = Field(default_factory=list)
    trigger: str = "initial_plan"
    objective_value: float = 0.0
    optimization_status: str = "Optimal"
    explanation: str = ""
    summary: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Base Agent Interface
# ---------------------------------------------------------------------------

class BaseAgent(ABC):
    """Common interface for all specialized agents in the Crisis Command ecosystem."""

    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description

    @abstractmethod
    def execute(self, input_data: Any) -> AgentResult:
        """
        Execute the agent's core responsibility.

        Args:
            input_data: Structured or semi-structured input specific to the agent.

        Returns:
            AgentResult containing the structured output and metadata.
        """
        pass

    def _success_result(self, data: Any, message: Optional[str] = None) -> AgentResult:
        """Helper to create a successful AgentResult."""
        return AgentResult(
            agent_name=self.name,
            success=True,
            data=data,
            message=message or f"{self.name} completed successfully.",
            timestamp=datetime.utcnow(),
        )

    def _error_result(self, error_message: str, data: Optional[Any] = None) -> AgentResult:
        """Helper to create an error AgentResult."""
        return AgentResult(
            agent_name=self.name,
            success=False,
            data=data,
            message=error_message,
            errors=[error_message],
            timestamp=datetime.utcnow(),
        )
