"""Command & Planning Agent (CPA) — AI Phase 6A (Equity + Explainability + Boundary Sentinel).

Coordinates the end-to-end multi-agent emergency response lifecycle:
  Incident Intake / State Change
               ↓
  Incident Assessment Agent (IAA)
               ↓
  Resource Allocation Agent (RAA + PuLP/CBC + Equity Breakdown)
               ↓
  Plan Comparison & Difference Engine (plan_diff)
               ↓
  Boundary Sentinel Evaluation (Fleet exhaustion, safety thresholds, critical deficits)
               ↓
  Revised Response Plan + Audit Logging + Human Approval Management
"""
import copy
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from agents.base_agent import (
    BaseAgent,
    AgentResult,
    IncidentAssessment,
    ResourceAllocation,
    ResourceAssignment,
    ResponsePlan,
)
from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.resource_allocation_agent import ResourceAllocationAgent
from config import Settings, get_settings
from models.schemas import (
    Approval,
    Assignment,
    Event,
    EventType,
    Incident,
    PlanChange,
    PlanHistoryEntry,
    Resource,
    ResourceStatus,
    ResourceType,
    Severity,
    UnassignedIncident,
)
from services.clock import SimClock
from services.plan_diff import build_explanation, diff_plans
from services.priority_service import PriorityService
from services.route_service import RouteService
from services.state_store import StateStore

logger = logging.getLogger("crisis-command.agent.cpa")


# ---------------------------------------------------------------------------
# Boundary Sentinel (Deterministic Safety Boundary Monitor)
# ---------------------------------------------------------------------------

class BoundarySentinel:
    """
    Deterministic Boundary Sentinel enforcing operational safety limits:
    1. Capability demand exceeds available fleet capacity (shortage).
    2. Critical life-safety incident has zero feasible resources assigned.
    3. Fleet / resource type exhaustion (all units of a required capability are committed).
    4. Critical response ETA exceeds configured safety threshold (>15.0 min).
    5. Mathematical optimizer reports infeasibility or solver failure.
    """

    def __init__(self, critical_eta_threshold_min: float = 15.0):
        self.critical_eta_threshold = critical_eta_threshold_min

    def evaluate(
        self,
        allocation: ResourceAllocation,
        incidents: List[Dict[str, Any]],
        assignments: List[ResourceAssignment],
        available_resources: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        violations: List[str] = []
        affected_incidents: List[str] = []
        exhausted_types: List[str] = []
        human_approval_required = False

        assigned_inc_ids = {a.incident_id for a in assignments}
        assigned_res_ids = {a.resource_id for a in assignments}

        # 1. Required capability exceeds available capacity (Missing Resources)
        if allocation.missing_resources:
            human_approval_required = True
            missing_str = ", ".join(set(allocation.missing_resources))
            violations.append(f"Capacity Shortfall: Unfulfilled demand for resource types: [{missing_str}].")
            for inc in incidents:
                inc_id = inc.get("id") or inc.get("incident_id")
                req_types = inc.get("required_resources") or []
                if any(t in allocation.missing_resources for t in req_types):
                    affected_incidents.append(inc_id)

        # 2. Critical incident with zero feasible resources assigned
        for inc in incidents:
            inc_id = inc.get("id") or inc.get("incident_id")
            sev = str(inc.get("severity") or "medium").lower()
            if sev == "critical" and inc_id not in assigned_inc_ids:
                human_approval_required = True
                violations.append(f"Critical Deficit: Life-threatening emergency {inc_id} has zero dispatched units.")
                affected_incidents.append(inc_id)

        # 3. Resource type exhaustion detection
        for inc in incidents:
            for req_type in (inc.get("required_resources") or []):
                req_str = str(req_type).lower()
                # Check remaining unassigned available units of this type
                remaining_units = [
                    r for r in available_resources
                    if str(r.get("type", "")).lower() == req_str
                    and (r.get("id") or r.get("resource_id")) not in assigned_res_ids
                    and str(r.get("status", "")).lower() in ("available", "operational", "idle")
                ]
                if not remaining_units and req_str not in exhausted_types:
                    exhausted_types.append(req_str)

        if exhausted_types:
            violations.append(f"Fleet Exhaustion: Zero standby capacity remaining for capability: [{', '.join(exhausted_types)}].")

        # 4. Critical response ETA exceeds safety threshold
        for a in assignments:
            # Check incident severity
            inc_info = next((i for i in incidents if (i.get("id") or i.get("incident_id")) == a.incident_id), None)
            inc_sev = str(inc_info.get("severity") if inc_info else "medium").lower()
            if inc_sev in ("critical", "high") and a.eta_minutes > self.critical_eta_threshold:
                human_approval_required = True
                violations.append(
                    f"Excessive ETA Hazard: Unit {a.resource_id} ETA is {a.eta_minutes:.1f} min to {a.incident_id} "
                    f"(exceeds safety threshold of {self.critical_eta_threshold} min)."
                )
                affected_incidents.append(a.incident_id)

        # 5. Solver infeasibility check
        if allocation.allocation_status == "unallocated" and len(incidents) > 0:
            human_approval_required = True
            violations.append("Optimizer Infeasibility: Mathematical solver could not produce a valid coverage plan.")

        return {
            "triggered": len(violations) > 0,
            "human_approval_required": human_approval_required,
            "violations": violations,
            "exhausted_types": exhausted_types,
            "affected_incidents": list(dict.fromkeys(affected_incidents)),
            "reason_summary": " | ".join(violations) if violations else "All safety boundaries satisfied.",
        }


# ---------------------------------------------------------------------------
# Command & Planning Agent
# ---------------------------------------------------------------------------

class CommandPlanningAgent(BaseAgent):
    """Command & Planning Agent (CPA) coordinates dynamic replanning across the emergency lifecycle."""

    def __init__(
        self,
        store: Optional[StateStore] = None,
        log=None,
        ws=None,
        assessor: Optional[IncidentAssessmentAgent] = None,
        allocator: Optional[ResourceAllocationAgent] = None,
        clock: Optional[SimClock] = None,
        settings: Optional[Settings] = None,
        persistence=None,
    ):
        super().__init__(
            name="Command & Planning Agent",
            description="Coordinates multi-agent workflows, evaluates state-change triggers, executes dynamic replanning, diffs response plans, and monitors Boundary Sentinel safety constraints.",
        )
        self.s = settings or get_settings()
        self.clock = clock or SimClock()
        self.store = store or StateStore(self.s)
        self.log = log
        self.ws = ws
        self.persistence = persistence

        self.assessor = assessor or IncidentAssessmentAgent(self.s)
        self.allocator = allocator or ResourceAllocationAgent(
            settings=self.s,
            route_service=RouteService(self.s),
            priority_service=PriorityService(self.s),
        )

        self.sentinel = BoundarySentinel(critical_eta_threshold_min=15.0)

        self.current_plan: Optional[ResponsePlan] = None
        self.plan_history: List[ResponsePlan] = []
        self.audit_log: List[Dict[str, Any]] = []

    # -------------------------------------------------------------------------
    # BaseAgent Execution Interface
    # -------------------------------------------------------------------------

    def execute(self, input_data: Any) -> AgentResult:
        """
        Standard agent execution wrapper.
        Accepts:
          - Dict with 'assessment' and 'allocation'
          - Dict with 'trigger', 'incidents', 'resources', 'previous_plan'
          - Raw incident dict/model (triggers full end-to-end pipeline)
        """
        try:
            # Case A: Assessment + Allocation passed directly
            if isinstance(input_data, dict) and "assessment" in input_data and "allocation" in input_data:
                plan = self._build_plan_from_assessment_and_allocation(
                    assessment=input_data["assessment"],
                    allocation=input_data["allocation"],
                    previous_plan=input_data.get("previous_plan") or self.current_plan,
                    trigger=input_data.get("trigger") or "Assessment & Allocation Complete",
                )
                return self._success_result(plan, f"Response Plan {plan.plan_id} created successfully.")

            # Case B: Replan request with explicit trigger and state
            trigger = "State change evaluation"
            incidents_in = None
            resources_in = None
            prev_plan = self.current_plan

            if isinstance(input_data, dict):
                trigger = input_data.get("trigger") or trigger
                incidents_in = input_data.get("incidents")
                resources_in = input_data.get("resources")
                if "previous_plan" in input_data:
                    prev_plan = input_data["previous_plan"]

            # Case C: End-to-end workflow execution
            plan = self.replan(
                trigger=trigger,
                incidents=incidents_in,
                resources=resources_in,
                previous_plan=prev_plan,
            )
            return self._success_result(plan, f"Plan {plan.plan_id} generated via dynamic replanning (Trigger: {trigger}).")

        except Exception as exc:
            logger.exception("CommandPlanningAgent execution error: %s", exc)
            return self._error_result(f"Command planning failed: {str(exc)}")

    # -------------------------------------------------------------------------
    # Dynamic Replanning Engine
    # -------------------------------------------------------------------------

    def replan(
        self,
        trigger: str,
        incidents: Optional[List[Any]] = None,
        resources: Optional[List[Any]] = None,
        previous_plan: Optional[ResponsePlan] = None,
    ) -> ResponsePlan:
        """
        Core Dynamic Replanning Routine:
        1. Gathers current system state (incidents, resources).
        2. Formulates previous pairs for stability bonus.
        3. Solves global multi-incident assignment via RAA (PuLP + CBC).
        4. Diffs previous plan vs new plan using plan_diff.
        5. Executes Boundary Sentinel to evaluate capacity, safety, and human approval limits.
        6. Records audit log and updates current state.
        """
        now = datetime.now(timezone.utc)
        prev_plan = previous_plan or self.current_plan

        # 1. Resolve incidents
        active_incidents = self._resolve_incidents(incidents)

        # 2. Resolve resources
        active_resources = self._resolve_resources(resources)

        # 3. Extract previous assignments for stability bonus and diffing
        previous_assignments: List[ResourceAssignment] = []
        previous_pairs: Set[Tuple[str, str]] = set()
        if prev_plan and prev_plan.assignments:
            previous_assignments = list(prev_plan.assignments)
            previous_pairs = {(a.resource_id, a.incident_id) for a in prev_plan.assignments}

        # 4. Trigger Resource Allocation Agent (PuLP + CBC)
        alloc_res = self.allocator.execute({
            "incidents": active_incidents,
            "resources": active_resources,
            "previous_pairs": previous_pairs,
        })

        if not alloc_res.success or not isinstance(alloc_res.data, ResourceAllocation):
            raise RuntimeError(f"Replanning allocation failed: {alloc_res.message}")

        allocation: ResourceAllocation = alloc_res.data
        new_assignments: List[ResourceAssignment] = list(allocation.allocated_resources)

        # 5. Compute Plan Differences (diff_plans)
        plan_changes, explanation_str = self._compute_plan_diff(
            trigger=trigger,
            previous_assignments=previous_assignments,
            new_assignments=new_assignments,
            incidents=active_incidents,
            resources=active_resources,
            missing_resources=allocation.missing_resources,
        )

        # 6. Evaluate Boundary Sentinel Constraints
        sentinel_eval = self.sentinel.evaluate(
            allocation=allocation,
            incidents=active_incidents,
            assignments=new_assignments,
            available_resources=active_resources,
        )

        attention_required = sentinel_eval["triggered"]
        human_approval_required = sentinel_eval["human_approval_required"]
        attention_reasons = sentinel_eval["violations"]

        # 7. Compute Estimated Response Metrics
        estimated_response = self._compute_response_metrics(new_assignments)

        # 8. Determine Plan Status
        if attention_required or human_approval_required:
            plan_status = "requires_attention"
        elif len(new_assignments) > 0:
            plan_status = "active"
        else:
            plan_status = "pending"

        # 9. Format Comprehensive Summary
        summary = (
            f"[REPLAN: {trigger.upper()}] Status: {plan_status.upper()}. "
            f"Allocated {len(new_assignments)} unit(s) across {len(active_incidents)} incident(s). "
            f"Objective: {allocation.allocations_by_incident.get('objective_value', 0.0)}. "
            f"Changes: {len(plan_changes)} update(s). "
            f"{explanation_str}"
        )
        if attention_reasons:
            summary += f" [BOUNDARY SENTINEL ALERT: {' | '.join(attention_reasons)}]"

        plan_id = f"PLN-{uuid4().hex[:8].upper()}"
        primary_incident_id = active_incidents[0].get("id") or active_incidents[0].get("incident_id") if active_incidents else "ALL"

        revised_plan = ResponsePlan(
            plan_id=plan_id,
            incident_id=str(primary_incident_id),
            plan_status=plan_status,
            assignments=new_assignments,
            estimated_response=estimated_response,
            attention_required=attention_required,
            attention_reason=" | ".join(attention_reasons) if attention_reasons else None,
            human_approval_required=human_approval_required,
            plan_changes=[c if isinstance(c, dict) else vars(c) for c in plan_changes],
            unassigned_incidents=allocation.unassigned_incidents,
            missing_resources=allocation.missing_resources,
            trigger=trigger,
            objective_value=float(allocation.total_allocated),
            optimization_status="Optimal" if len(allocation.unallocated_resource_types) == 0 else "ShortageDetected",
            explanation=explanation_str,
            summary=summary,
            created_at=now,
        )

        # 10. Audit Logging & History Tracking
        self._record_audit_event(
            plan=revised_plan,
            trigger=trigger,
            plan_changes=plan_changes,
            sentinel_eval=sentinel_eval,
            now=now,
        )

        self.current_plan = revised_plan
        self.plan_history.append(revised_plan)

        return revised_plan

    # -------------------------------------------------------------------------
    # State Change Trigger Handlers
    # -------------------------------------------------------------------------

    def on_incident_created(self, incident_data: Any) -> ResponsePlan:
        """Triggered when a new incident arrives: assesses via IAA, then dynamically replans."""
        ass_res = self.assessor.execute(incident_data)
        assessment = ass_res.data if (ass_res.success and isinstance(ass_res.data, IncidentAssessment)) else None

        inc_id = assessment.incident_id if assessment else (incident_data.get("id") or "INC-NEW")
        itype = assessment.incident_type if assessment else "Incident"
        sev = assessment.severity if assessment else "medium"

        trigger_msg = f"New {sev.upper()} incident reported: {inc_id} ({itype})"

        incidents = [assessment or incident_data]
        if hasattr(self.store, "incidents") and self.store.incidents:
            for existing_inc in self.store.incidents.values():
                if existing_inc.id != inc_id:
                    incidents.append(existing_inc)

        return self.replan(trigger=trigger_msg, incidents=incidents)

    def on_resource_unavailable(self, resource_id: str, reason: str = "Out of service") -> ResponsePlan:
        """Triggered when an active unit breaks down or goes offline."""
        trigger_msg = f"Resource {resource_id} became UNAVAILABLE ({reason})"

        if hasattr(self.store, "resources") and resource_id in self.store.resources:
            self.store.resources[resource_id].status = ResourceStatus.unavailable
            self.store.resources[resource_id].status_reason = reason

        return self.replan(trigger=trigger_msg)

    def on_resource_restored(self, resource_id: str) -> ResponsePlan:
        """Triggered when a previously offline unit returns to service."""
        trigger_msg = f"Resource {resource_id} returned to service (AVAILABLE)"

        if hasattr(self.store, "resources") and resource_id in self.store.resources:
            self.store.resources[resource_id].status = ResourceStatus.available
            self.store.resources[resource_id].status_reason = None

        return self.replan(trigger=trigger_msg)

    def on_resource_competition(self, trigger_description: str) -> ResponsePlan:
        """Triggered when simultaneous incidents compete for shared fleet units."""
        return self.replan(trigger=f"Resource competition detected: {trigger_description}")

    # -------------------------------------------------------------------------
    # Helper & Diff Logic
    # -------------------------------------------------------------------------

    def _resolve_incidents(self, incidents: Optional[List[Any]]) -> List[Dict[str, Any]]:
        """Extract or fall back to store incidents."""
        if incidents:
            out = []
            for item in incidents:
                if isinstance(item, dict):
                    out.append(item)
                elif isinstance(item, IncidentAssessment):
                    out.append(item.model_dump())
                elif hasattr(item, "model_dump"):
                    out.append(item.model_dump())
                else:
                    out.append(vars(item))
            return out

        if hasattr(self.store, "incidents") and self.store.incidents:
            return [i.model_dump() if hasattr(i, "model_dump") else dict(i) for i in self.store.incidents.values()]

        return [{
            "id": "INC-001",
            "type": "Building Fire",
            "severity": "critical",
            "urgency": 9,
            "required_resources": ["fire_team", "ambulance"],
            "latitude": self.s.city_center[0],
            "longitude": self.s.city_center[1],
        }]

    def _resolve_resources(self, resources: Optional[List[Any]]) -> List[Dict[str, Any]]:
        """Extract or fall back to store/seed resources."""
        if resources:
            out = []
            for item in resources:
                if isinstance(item, dict):
                    out.append(item)
                elif hasattr(item, "model_dump"):
                    out.append(item.model_dump())
                else:
                    out.append(vars(item))
            return out

        if hasattr(self.store, "resources") and self.store.resources:
            return [r.model_dump() if hasattr(r, "model_dump") else dict(r) for r in self.store.resources.values()]

        try:
            from services.resource_store import resource_store
            return [r.model_dump() for r in resource_store.get_all()]
        except Exception:
            return []

    def _compute_plan_diff(
        self,
        trigger: str,
        previous_assignments: List[ResourceAssignment],
        new_assignments: List[ResourceAssignment],
        incidents: List[Dict[str, Any]],
        resources: List[Dict[str, Any]],
        missing_resources: List[str],
    ) -> Tuple[List[Dict[str, Any]], str]:
        """Compare previous assignments with new assignments and generate structured changes."""
        prev_map = {a.resource_id: a for a in previous_assignments}
        new_map = {a.resource_id: a for a in new_assignments}
        res_map = {r["id"] if isinstance(r, dict) else r.id: r for r in resources}
        inc_map = {i["id"] if isinstance(i, dict) else i.id: i for i in incidents}

        changes: List[Dict[str, Any]] = []

        # 1. Newly assigned & Reallocated
        for rid, new_a in sorted(new_map.items()):
            old_a = prev_map.get(rid)
            if old_a is None:
                text = f"{rid} was newly ASSIGNED to {new_a.incident_id} for {new_a.resource_type}. ({new_a.reason})"
                changes.append({
                    "kind": "assigned",
                    "resource_id": rid,
                    "to_incident": new_a.incident_id,
                    "text": text,
                })
            elif old_a.incident_id != new_a.incident_id:
                text = f"{rid} was REALLOCATED from {old_a.incident_id} to {new_a.incident_id}. ({new_a.reason})"
                changes.append({
                    "kind": "reallocated",
                    "resource_id": rid,
                    "from_incident": old_a.incident_id,
                    "to_incident": new_a.incident_id,
                    "text": text,
                })

        # 2. Released & Lost
        for rid, old_a in sorted(prev_map.items()):
            if rid not in new_map:
                res = res_map.get(rid)
                status = res.get("status") if isinstance(res, dict) else (res.status.value if res else "available")
                if str(status).lower() in ("unavailable", "maintenance", "offline"):
                    text = f"{rid} became {status.upper()}; {old_a.incident_id} lost this {old_a.resource_type} unit."
                    changes.append({
                        "kind": "lost",
                        "resource_id": rid,
                        "from_incident": old_a.incident_id,
                        "text": text,
                    })
                else:
                    text = f"{rid} was RELEASED from {old_a.incident_id} and is now available."
                    changes.append({
                        "kind": "released",
                        "resource_id": rid,
                        "from_incident": old_a.incident_id,
                        "text": text,
                    })

        # 3. Build text explanation
        explanation_parts = [f"Trigger: {trigger}."]
        if changes:
            explanation_parts.extend([c["text"] for c in changes])
        else:
            explanation_parts.append("No assignment changes required; existing allocation remains optimal.")

        if missing_resources:
            explanation_parts.append(f"Unfulfilled capability shortages: {', '.join(set(missing_resources))}.")

        return changes, " ".join(explanation_parts)

    def _compute_response_metrics(self, assignments: List[ResourceAssignment]) -> Dict[str, Any]:
        """Compute summary statistics over the dispatched response assignments."""
        if not assignments:
            return {
                "first_unit_arrival_min": 0.0,
                "full_deployment_arrival_min": 0.0,
                "average_eta_min": 0.0,
                "max_transit_distance_km": 0.0,
                "total_units_dispatched": 0,
            }

        etas = [a.eta_minutes for a in assignments]
        distances = [a.distance_km for a in assignments]
        return {
            "first_unit_arrival_min": round(min(etas), 1),
            "full_deployment_arrival_min": round(max(etas), 1),
            "average_eta_min": round(sum(etas) / len(etas), 1),
            "max_transit_distance_km": round(max(distances), 2),
            "total_units_dispatched": len(assignments),
        }

    def _record_audit_event(
        self,
        plan: ResponsePlan,
        trigger: str,
        plan_changes: List[Dict[str, Any]],
        sentinel_eval: Optional[Dict[str, Any]],
        now: datetime,
    ) -> None:
        """Maintain persistent audit log of all replanning triggers, changes, and Sentinel events."""
        audit_entry = {
            "event_id": f"EVT-{uuid4().hex[:8].upper()}",
            "timestamp": now.isoformat(),
            "trigger": trigger,
            "plan_id": plan.plan_id,
            "plan_status": plan.plan_status,
            "attention_required": plan.attention_required,
            "human_approval_required": plan.human_approval_required,
            "assigned_units_count": len(plan.assignments),
            "changes_count": len(plan_changes),
            "changes": plan_changes,
            "missing_resources": plan.missing_resources,
            "sentinel_violations": sentinel_eval.get("violations", []) if sentinel_eval else [],
            "exhausted_types": sentinel_eval.get("exhausted_types", []) if sentinel_eval else [],
        }
        self.audit_log.append(audit_entry)

    def _build_plan_from_assessment_and_allocation(
        self,
        assessment: Any,
        allocation: Any,
        previous_plan: Optional[ResponsePlan],
        trigger: str,
    ) -> ResponsePlan:
        """Helper to build a ResponsePlan when assessment and allocation are explicitly passed."""
        ass_dict = assessment.model_dump() if hasattr(assessment, "model_dump") else (assessment if isinstance(assessment, dict) else vars(assessment))
        alloc_model = allocation if isinstance(allocation, ResourceAllocation) else ResourceAllocation(**allocation)

        incidents = [ass_dict]
        prev_assignments = previous_plan.assignments if previous_plan else []
        new_assignments = alloc_model.allocated_resources

        plan_changes, explanation_str = self._compute_plan_diff(
            trigger=trigger,
            previous_assignments=prev_assignments,
            new_assignments=new_assignments,
            incidents=incidents,
            resources=[],
            missing_resources=alloc_model.missing_resources,
        )

        sentinel_eval = self.sentinel.evaluate(
            allocation=alloc_model,
            incidents=incidents,
            assignments=new_assignments,
            available_resources=[],
        )

        attention_req = sentinel_eval["triggered"]
        approval_req = sentinel_eval["human_approval_required"]
        attention_reasons = sentinel_eval["violations"]

        metrics = self._compute_response_metrics(new_assignments)
        plan_status = "requires_attention" if (attention_req or approval_req) else ("active" if new_assignments else "pending")

        summary = (
            f"Response Plan for {ass_dict.get('incident_type', 'Incident')} ({ass_dict.get('severity', 'medium').upper()}). "
            f"Status: {plan_status.upper()}. {len(new_assignments)} unit(s) assigned. {explanation_str}"
        )
        if attention_reasons:
            summary += f" [BOUNDARY SENTINEL ALERT: {' | '.join(attention_reasons)}]"

        plan = ResponsePlan(
            plan_id=f"PLN-{uuid4().hex[:8].upper()}",
            incident_id=str(ass_dict.get("incident_id") or "INC-001"),
            plan_status=plan_status,
            assignments=new_assignments,
            estimated_response=metrics,
            attention_required=attention_req,
            attention_reason=" | ".join(attention_reasons) if attention_reasons else None,
            human_approval_required=approval_req,
            plan_changes=plan_changes,
            unassigned_incidents=alloc_model.unassigned_incidents,
            missing_resources=alloc_model.missing_resources,
            trigger=trigger,
            objective_value=float(alloc_model.total_allocated),
            explanation=explanation_str,
            summary=summary,
            created_at=datetime.now(timezone.utc),
        )

        self.current_plan = plan
        self.plan_history.append(plan)
        return plan

    # -------------------------------------------------------------------------
    # Container & Operational Lifecycle Interface
    # -------------------------------------------------------------------------

    def _now(self) -> datetime:
        return self.clock.now() if hasattr(self.clock, "now") else datetime.now(timezone.utc)

    async def _replan_internal(self, trigger: str) -> Any:
        """Internal replanning executing over the StateStore and publishing events."""
        from datetime import timedelta
        from models.errors import Conflict, NotFound
        from models.schemas import Approval, Assignment, EventType, PlanHistoryEntry, ResponsePlan as PlanSchema, Severity
        from services.plan_diff import diff_plans
        from services.priority_service import PriorityService

        now = self._now()
        self.store.refresh_waiting(now)
        active_incidents = self.store.active_incidents()
        active_resources = list(self.store.resources.values())
        previous_pairs = {(a.resource_id, a.incident_id) for a in self.store.assignments}

        prio_service = PriorityService(self.s)
        priorities = {i.id: prio_service.effective_priority(i) for i in active_incidents}

        opt = self.allocator.optimizer.solve(active_incidents, active_resources, priorities, previous_pairs)

        # Handle shortages and Boundary Sentinel approvals
        new_approvals = []
        if opt.missing:
            for iid, missing_types in opt.missing.items():
                inc = self.store.incidents.get(iid)
                if not inc:
                    continue
                missing_str = ", ".join(t.value for t in missing_types)
                sig = f"{iid}:{missing_str}"
                if sig not in self.store.acknowledged:
                    appr_id = self.store.next_id("APR")
                    appr = Approval(
                        id=appr_id,
                        plan_id="PLN_PENDING",
                        status="pending",
                        reason=f"No available {missing_str} for {iid} ({inc.type})",
                        recommended_action=f"Request mutual aid or reallocate units for {missing_str}",
                        incident_ids=[iid],
                        missing={iid: [t.value for t in missing_types]},
                        signature=sig,
                        created_at=now,
                    )
                    self.store.approvals[appr_id] = appr
                    new_approvals.append(appr)
                    if self.log:
                        self.log.record(
                            event_type=EventType.HUMAN_APPROVAL_REQUIRED,
                            timestamp=now,
                            description=f"Human approval required: {appr.reason}",
                            affected=[iid],
                            reason=appr.reason,
                        )
                    # If zero supply available for any required type, log Boundary Collapse
                    if all(r.status != ResourceStatus.available for r in active_resources if r.type in missing_types):
                        if self.log:
                            self.log.record(
                                event_type=EventType.BOUNDARY_COLLAPSE,
                                timestamp=now,
                                description=f"Boundary collapse: fleet exhausted for {missing_str}",
                                affected=[iid],
                            )

        # Compute plan diffs
        prev_plan = self.store.current_plan
        prev_assignments = self.store.assignments
        diff = diff_plans(prev_assignments, opt.chosen, trigger, self.store.incidents, self.store.resources, opt.missing)

        plan_id = self.store.next_id("PLN")
        assignments = []
        for c in opt.chosen:
            assignments.append(
                Assignment(
                    id=f"{c.incident_id}_{c.resource_id}",
                    incident_id=c.incident_id,
                    resource_id=c.resource_id,
                    resource_type=c.resource_type,
                    distance=c.distance_km,
                    eta=c.eta_min,
                    status="assigned",
                    reason=f"Assigned to {c.incident_id} (ETA: {c.eta_min:.1f}m, Dist: {c.distance_km:.1f}km)",
                    created_at=now,
                )
            )

        has_pending = len(self.store.pending_approvals()) > 0
        plan = PlanSchema(
            plan_id=plan_id,
            created_at=now,
            assignments=assignments,
            unassigned_incidents=[
                UnassignedIncident(
                    incident_id=iid,
                    missing_resources=types,
                    no_supply_types=[t for t in types if not any(r.type == t and r.status == ResourceStatus.available for r in active_resources)],
                    reason=f"Shortage of {', '.join(t.value for t in types)}",
                )
                for iid, types in opt.missing.items()
            ],
            human_approval_required=has_pending,
            explanation=diff.explanation,
            objective_value=opt.objective_value,
            optimization_status=opt.status,
            trigger=trigger,
            changes=diff.changes,
        )

        for appr in new_approvals:
            appr.plan_id = plan_id

        self.store.current_plan = plan
        self.store.assignments = assignments

        # Update assignment states on incidents and resources
        assigned_inc_map: Dict[str, List[str]] = {}
        for a in assignments:
            assigned_inc_map.setdefault(a.incident_id, []).append(a.resource_id)
            if a.resource_id in self.store.resources:
                self.store.resources[a.resource_id].current_assignment = a.incident_id
                self.store.resources[a.resource_id].eta = a.eta

        for iid, inc in self.store.incidents.items():
            if iid in assigned_inc_map:
                inc.assigned_resources = assigned_inc_map[iid]
                inc.status = "assigned"
            elif inc.status != "resolved":
                inc.assigned_resources = []
                inc.status = "waiting" if iid in opt.missing else "pending"

        # Record PlanHistoryEntry
        self.store.plan_history.append(
            PlanHistoryEntry(
                plan_id=plan_id,
                created_at=now,
                trigger=trigger,
                previous=[{"resource_id": a.resource_id, "incident_id": a.incident_id} for a in prev_assignments],
                new=[{"resource_id": a.resource_id, "incident_id": a.incident_id} for a in assignments],
                changes=diff.changes,
                reason=diff.explanation,
            )
        )

        if self.log:
            self.log.record(
                event_type=EventType.PLAN_RECALCULATED,
                timestamp=now,
                description=f"Plan {plan_id} recalculated: {trigger}",
                reason=diff.explanation,
            )

        if self.persistence:
            self.persistence.save(self.store, self.log, self.clock)

        if self.ws:
            try:
                events_to_pub = self.log.list(10) if self.log else []
                await self.ws.publish(events_to_pub, self.snapshot())
            except Exception:
                pass

        return plan

    async def create_incident(self, body: Any, source: str = "api") -> Tuple[Incident, Any]:
        """Create an incident, assess, log, optimize and return (incident, plan)."""
        from models.schemas import Incident, IncidentStatus, Severity
        now = self._now()
        desc = getattr(body, "description", "") or ""
        lat = getattr(body, "latitude", None)
        lon = getattr(body, "longitude", None)

        ass = self.assessor.assess(desc, lat, lon)
        inc_id = self.store.next_id("INC")

        inc_type = getattr(body, "type", None) or ass.incident_type
        sev = getattr(body, "severity", None) or ass.severity
        urg = getattr(body, "urgency", None) or ass.urgency
        req = getattr(body, "required_resources", None) or ass.required_resources

        inc = Incident(
            id=inc_id,
            type=inc_type,
            description=desc,
            latitude=float(lat or ass.location.latitude),
            longitude=float(lon or ass.location.longitude),
            severity=Severity(sev.value if hasattr(sev, "value") else str(sev)),
            urgency=int(urg),
            required_resources=list(req),
            status=IncidentStatus.pending,
            created_at=now,
            waiting_time=0.0,
            location_name=ass.location.name,
            assessment_confidence=ass.confidence,
            assessment_source=ass.source,
            assessment_explanation=ass.explanation,
        )
        self.store.incidents[inc.id] = inc
        if self.log:
            self.log.record(
                event_type=EventType.INCIDENT_CREATED,
                timestamp=now,
                description=f"Incident {inc.id} reported: [{inc.severity.value.upper()}] {inc.type}",
                affected=[inc.id],
            )

        plan = await self._replan_internal(f"incident {inc.id} created")
        return self.store.incidents[inc.id], plan

    async def update_incident(self, incident_id: str, body: Any) -> Tuple[Incident, Any]:
        inc = self.store.get_incident(incident_id)
        for field in ("description", "latitude", "longitude", "severity", "urgency", "required_resources", "status"):
            val = getattr(body, field, None)
            if val is not None:
                setattr(inc, field, val)
        now = self._now()
        if self.log:
            self.log.record(
                event_type=EventType.INCIDENT_UPDATED,
                timestamp=now,
                description=f"Incident {incident_id} updated",
                affected=[incident_id],
            )
        plan = await self._replan_internal(f"incident {incident_id} updated")
        return inc, plan

    async def create_resource(self, body: Any) -> Resource:
        from models.errors import Conflict, CrisisError
        from models.schemas import Resource, ResourceStatus
        rid = getattr(body, "id", None) or self.store.new_resource_id(body.type)
        if rid in self.store.resources:
            raise Conflict("resource_exists", f"Resource '{rid}' already exists.")

        default_caps = list(self.s.default_capabilities.get(body.type.value, [body.type.value]))
        caps = getattr(body, "capabilities", None) or default_caps
        required_cap = self.s.required_capability.get(body.type.value)
        if required_cap and required_cap not in caps:
            raise CrisisError(422, "invalid_capabilities", f"Resource missing required capability '{required_cap}'.")

        res = Resource(
            id=rid,
            type=body.type,
            latitude=body.latitude,
            longitude=body.longitude,
            status=getattr(body, "status", ResourceStatus.available),
            capabilities=caps,
        )
        self.store.add_resource(res)
        now = self._now()
        if self.log:
            self.log.record(
                event_type=EventType.RESOURCE_AVAILABLE,
                timestamp=now,
                description=f"Resource {res.id} ({res.type.value}) added to fleet",
                affected=[res.id],
            )
        if self.persistence:
            self.persistence.save(self.store, self.log, self.clock)
        return res

    async def update_resource(self, resource_id: str, body: Any) -> Tuple[Resource, Any]:
        from models.errors import CrisisError
        res = self.store.get_resource(resource_id)
        new_status = getattr(body, "status", None)
        if new_status and new_status.value == "assigned":
            raise CrisisError(422, "invalid_status", "Cannot manually set status to assigned.")
        if new_status:
            res.status = new_status
        if getattr(body, "latitude", None) is not None:
            res.latitude = body.latitude
        if getattr(body, "longitude", None) is not None:
            res.longitude = body.longitude
        if getattr(body, "capabilities", None) is not None:
            res.capabilities = body.capabilities
        if getattr(body, "reason", None) is not None:
            res.status_reason = body.reason

        now = self._now()
        if self.log:
            self.log.record(
                event_type=EventType.RESOURCE_UPDATED,
                timestamp=now,
                description=f"Resource {resource_id} updated",
                affected=[resource_id],
            )
        plan = await self._replan_internal(f"resource {resource_id} updated")
        return res, plan

    async def resource_unavailable(self, resource_id: str, reason: str = "Reported unavailable") -> Any:
        from models.errors import Conflict
        res = self.store.get_resource(resource_id)
        if res.status == ResourceStatus.unavailable:
            raise Conflict("resource_already_unavailable", f"Resource '{resource_id}' is already unavailable.")
        res.status = ResourceStatus.unavailable
        res.status_reason = reason
        now = self._now()
        if self.log:
            self.log.record(
                event_type=EventType.RESOURCE_UNAVAILABLE,
                timestamp=now,
                description=f"Resource {resource_id} reported unavailable: {reason}",
                affected=[resource_id],
                reason=reason,
            )
        return await self._replan_internal(f"{resource_id} became unavailable")

    async def resource_available(self, resource_id: str) -> Any:
        from models.errors import Conflict
        res = self.store.get_resource(resource_id)
        if res.status == ResourceStatus.available:
            raise Conflict("resource_not_unavailable", f"Resource '{resource_id}' is not unavailable.")
        res.status = ResourceStatus.available
        res.status_reason = None
        now = self._now()
        if self.log:
            self.log.record(
                event_type=EventType.RESOURCE_AVAILABLE,
                timestamp=now,
                description=f"Resource {resource_id} returned to service",
                affected=[resource_id],
            )
        # Supersede approvals if relevant
        for a in self.store.pending_approvals():
            if res.type.value in a.missing.get(a.incident_ids[0] if a.incident_ids else "", []):
                a.status = "superseded"
        return await self._replan_internal(f"{resource_id} became available")

    async def recalculate(self, trigger: str = "operator requested recalculation") -> Any:
        return await self._replan_internal(trigger)

    async def decide(self, approved: bool, approval_id: Optional[str] = None, note: Optional[str] = None) -> Approval:
        from models.errors import Conflict
        from models.schemas import ApprovalStatus
        pending = self.store.pending_approvals()
        if not pending:
            raise Conflict("no_pending_approval", "No pending approval requests.")

        target = None
        if approval_id:
            target = self.store.approvals.get(approval_id)
            if not target or target.status != ApprovalStatus.pending:
                raise Conflict("approval_conflict", f"Approval '{approval_id}' not found or already resolved.")
        else:
            target = pending[0]

        target.status = ApprovalStatus.approved if approved else ApprovalStatus.rejected
        target.resolved_at = self._now()
        target.note = note
        self.store.acknowledged[target.signature] = target.id

        if approved and self.store.current_plan:
            self.store.current_plan.human_approval_required = False

        now = self._now()
        evt_type = EventType.APPROVAL_APPROVED if approved else EventType.APPROVAL_REJECTED
        if self.log:
            self.log.record(
                event_type=evt_type,
                timestamp=now,
                description=f"Approval {target.id} {'APPROVED' if approved else 'REJECTED'}: {note or 'Operator decision'}",
                affected=target.incident_ids,
            )

        if self.persistence:
            self.persistence.save(self.store, self.log, self.clock)
        if self.ws:
            try:
                await self.ws.publish(self.log.list(10) if self.log else [], self.snapshot())
            except Exception:
                pass
        return target

    async def advance_time(self, minutes: float = 10.0) -> Any:
        from datetime import timedelta
        self.clock.offset += timedelta(minutes=minutes)
        now = self._now()
        self.store.refresh_waiting(now)
        if self.log:
            self.log.record(
                event_type=EventType.TIME_ADVANCED,
                timestamp=now,
                description=f"Simulation clock advanced by {minutes:.0f} minutes",
            )
        return await self._replan_internal(f"advanced {minutes:.0f} minutes")

    async def demo_t0(self) -> Any:
        from models.schemas import IncidentCreate
        from services.simulation_service import DEMO_T0
        await self.reset()
        for text in DEMO_T0:
            await self.create_incident(IncidentCreate(description=text))
        return self.store.current_plan

    async def demo_t10(self) -> Any:
        from datetime import timedelta
        from models.schemas import IncidentCreate
        from services.simulation_service import DEMO_T10
        self.clock.offset += timedelta(minutes=10)
        self.store.refresh_waiting(self._now())
        if "A01" in self.store.resources:
            self.store.resources["A01"].status = ResourceStatus.unavailable
            self.store.resources["A01"].status_reason = "Mechanical breakdown"
            if self.log:
                self.log.record(
                    event_type=EventType.RESOURCE_UNAVAILABLE,
                    timestamp=self._now(),
                    description="Resource A01 reported unavailable: Mechanical breakdown",
                    affected=["A01"],
                )
        await self.create_incident(IncidentCreate(description=DEMO_T10))
        return self.store.current_plan

    async def sim_incident(self, kind: str) -> Tuple[Incident, Any]:
        from models.schemas import IncidentCreate
        from services.simulation_service import random_incident_text
        text = random_incident_text(kind)
        return await self.create_incident(IncidentCreate(description=text))

    async def break_ambulance(self) -> Any:
        for r in self.store.resources.values():
            if r.type == ResourceType.ambulance and r.status in (ResourceStatus.available, ResourceStatus.assigned):
                return await self.resource_unavailable(r.id, "Simulated breakdown")
        return self.store.current_plan

    async def restore_ambulance(self) -> Any:
        for r in self.store.resources.values():
            if r.type == ResourceType.ambulance and r.status == ResourceStatus.unavailable:
                return await self.resource_available(r.id)
        return self.store.current_plan

    async def reset(self) -> None:
        from datetime import timedelta
        self.store.reset()
        if self.log:
            self.log.clear()
            self.log.record(
                event_type=EventType.SCENARIO_RESET,
                timestamp=self._now(),
                description="Scenario reset: working set cleared and restored to initial seed.",
            )
        self.clock.offset = timedelta(0)
        self.current_plan = None
        self.plan_history.clear()
        self.audit_log.clear()
        if self.persistence:
            self.persistence.mark_reset()
            self.persistence.save(self.store, self.log, self.clock)
        if self.ws:
            try:
                await self.ws.publish(self.log.list(5) if self.log else [], self.snapshot())
            except Exception:
                pass

    def snapshot(self) -> dict:
        return {
            "incidents": [i.model_dump(mode="json") for i in self.store.incidents.values()],
            "resources": [r.model_dump(mode="json") for r in self.store.resources.values()],
            "plan": self.store.current_plan.model_dump(mode="json") if self.store.current_plan else None,
            "approvals": [a.model_dump(mode="json") for a in self.store.approvals.values()],
            "events": [e.model_dump(mode="json") for e in (self.log.list(50) if self.log else [])],
            "summary": self.store.current_plan.explanation if self.store.current_plan else "System nominal",
            "clock": self._now().isoformat(),
        }

