"""Resource Allocation Agent (RAA) — AI Phase 6A (Equity + Explainability Integration).

Delegates mathematical resource allocation to PuLP + CBC MILP solver.
Prepares validated incident and resource data, solves the global multi-incident assignment problem,
enforces hard constraints, and generates structured, deterministic, data-backed explainability.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from config import Settings, get_settings
from agents.base_agent import (
    BaseAgent,
    AgentResult,
    IncidentAssessment,
    ResourceAllocation,
    ResourceAssignment,
)
from models.errors import OptimizationError
from models.schemas import (
    Incident,
    Resource,
    ResourceStatus,
    ResourceType,
    Severity,
)
from optimization.resource_optimizer import OptimizationResult, ResourceOptimizer
from services.priority_service import PriorityService
from services.route_service import RouteService

logger = logging.getLogger("crisis-command.agent.raa")


class ResourceAllocationAgent(BaseAgent):
    """Resource Allocation Agent (RAA) integrates PuLP + CBC mathematical optimization with equity & explainability."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        route_service: Optional[RouteService] = None,
        priority_service: Optional[PriorityService] = None,
        optimizer: Optional[ResourceOptimizer] = None,
    ):
        super().__init__(
            name="Resource Allocation Agent",
            description="Solves global multi-incident resource allocation using PuLP + CBC MILP mathematical optimization with equity-aware priority and data-backed explainability.",
        )
        self.s = settings or get_settings()
        self.route = route_service or RouteService(self.s)
        self.priority = priority_service or PriorityService(self.s)
        self.optimizer = optimizer or ResourceOptimizer(self.s, self.route)

    def execute(self, input_data: Any) -> AgentResult:
        """
        Execute mathematical resource allocation via PuLP/CBC.

        Args:
            input_data: Dict containing 'incidents' or single 'incident'/'assessment',
                        optional 'resources', and optional 'previous_pairs'.
        """
        now = datetime.now(timezone.utc)
        try:
            # 1. Parse and validate domain entities
            incidents, resources, previous_pairs = self._prepare_data(input_data, now)

            if not incidents:
                return self._error_result("No incidents provided for resource allocation.")

            # 2. Compute equity-aware effective priorities & structured breakdowns
            priority_breakdowns = {inc.id: self.priority.breakdown(inc) for inc in incidents}
            priorities = {inc.id: priority_breakdowns[inc.id]["effective_priority"] for inc in incidents}

            # 3. Invoke PuLP + CBC Mathematical Optimizer
            try:
                opt_result = self.optimizer.solve(
                    incidents=incidents,
                    resources=resources,
                    priorities=priorities,
                    previous_pairs=previous_pairs,
                )
            except OptimizationError as opt_err:
                logger.warning("PuLP/CBC optimization error: %s", opt_err)
                return self._handle_solver_failure(incidents, str(opt_err), now)
            except Exception as exc:
                logger.exception("Unexpected solver execution error: %s", exc)
                return self._handle_solver_failure(incidents, str(exc), now)

            # 4. Transform optimization result into structured allocations and rich explainability
            allocation_model = self._build_allocation_result(
                incidents=incidents,
                resources=resources,
                priorities=priorities,
                priority_breakdowns=priority_breakdowns,
                opt_result=opt_result,
                now=now,
            )

            return self._success_result(
                data=allocation_model,
                message=(
                    f"PuLP/CBC Optimization ({opt_result.status}): {allocation_model.allocation_status} "
                    f"({allocation_model.total_allocated} assigned, {len(allocation_model.missing_resources)} missing, "
                    f"Objective Value: {opt_result.objective_value})"
                ),
            )

        except Exception as exc:
            logger.exception("Resource allocation agent failed: %s", exc)
            return self._error_result(f"Resource allocation failed: {str(exc)}")

    # -------------------------------------------------------------------------
    # Backwards Compatibility Method
    # -------------------------------------------------------------------------

    def allocate(
        self,
        incidents: List[Incident],
        resources: List[Resource],
        previous_pairs: Set[Tuple[str, str]],
        now: datetime,
    ) -> Any:
        """Legacy compatibility interface for direct internal calls."""
        priorities = {i.id: self.priority.effective_priority(i) for i in incidents}
        return self.optimizer.solve(incidents, resources, priorities, previous_pairs)

    # -------------------------------------------------------------------------
    # Data Preparation & Normalization
    # -------------------------------------------------------------------------

    def _prepare_data(
        self, input_data: Any, now: datetime
    ) -> Tuple[List[Incident], List[Resource], Set[Tuple[str, str]]]:
        """Convert input payload into validated Pydantic domain models for the optimizer."""
        raw_incidents: List[Any] = []
        raw_resources: List[Any] = []
        previous_pairs: Set[Tuple[str, str]] = set()

        if isinstance(input_data, dict):
            if "incidents" in input_data and isinstance(input_data["incidents"], list):
                raw_incidents = input_data["incidents"]
            elif "assessment" in input_data:
                raw_incidents = [input_data["assessment"]]
            elif "incident" in input_data:
                raw_incidents = [input_data["incident"]]
            else:
                raw_incidents = [input_data]

            raw_resources = input_data.get("resources") or []
            pairs = input_data.get("previous_pairs") or []
            if isinstance(pairs, (list, set)):
                previous_pairs = set(tuple(p) for p in pairs)
        elif isinstance(input_data, (list, tuple)):
            raw_incidents = list(input_data)
        elif isinstance(input_data, IncidentAssessment) or hasattr(input_data, "model_dump"):
            raw_incidents = [input_data]
        else:
            raw_incidents = [vars(input_data)]

        # If no resources passed, pull active resources from resource_store
        if not raw_resources:
            try:
                from services.resource_store import resource_store
                all_res = resource_store.get_all()
                raw_resources = [r.model_dump() if hasattr(r, "model_dump") else dict(r) for r in all_res]
            except Exception:
                raw_resources = []

        # Validate incidents
        valid_incidents: List[Incident] = []
        for inc_item in raw_incidents:
            norm_inc = self._to_incident_model(inc_item, now)
            if norm_inc:
                valid_incidents.append(norm_inc)

        # Validate resources
        valid_resources: List[Resource] = []
        for res_item in raw_resources:
            norm_res = self._to_resource_model(res_item)
            if norm_res:
                valid_resources.append(norm_res)

        return valid_incidents, valid_resources, previous_pairs

    def _to_incident_model(self, item: Any, now: datetime) -> Optional[Incident]:
        """Convert raw incident data or IncidentAssessment into models.schemas.Incident."""
        if isinstance(item, Incident):
            return item

        if isinstance(item, IncidentAssessment):
            loc = item.location or {}
            lat = loc.get("latitude") if isinstance(loc, dict) else self.s.city_center[0]
            lon = loc.get("longitude") if isinstance(loc, dict) else self.s.city_center[1]

            valid_types: List[ResourceType] = []
            for r in item.required_resources:
                try:
                    valid_types.append(ResourceType(str(r).lower()))
                except ValueError:
                    pass

            return Incident(
                id=item.incident_id or "INC-001",
                type=item.incident_type,
                description=item.reasoning or "Incident Report",
                latitude=float(lat or self.s.city_center[0]),
                longitude=float(lon or self.s.city_center[1]),
                severity=Severity(item.severity.lower()),
                urgency=item.urgency,
                required_resources=valid_types,
                created_at=now,
                waiting_time=float(item.waiting_time_minutes or 0.0),
            )

        if hasattr(item, "model_dump"):
            data = item.model_dump()
        elif isinstance(item, dict):
            data = dict(item)
        else:
            data = vars(item)

        inc_id = str(data.get("incident_id") or data.get("id") or "INC-001")
        itype = str(data.get("type") or "General Emergency")
        desc = str(data.get("description") or "Emergency incident")

        loc = data.get("location") or {}
        lat = data.get("latitude")
        lon = data.get("longitude")
        if lat is None and isinstance(loc, dict):
            lat = loc.get("latitude")
            lon = loc.get("longitude")

        sev_str = str(data.get("severity") or "medium").lower()
        if sev_str not in ("critical", "high", "medium", "low"):
            sev_str = "medium"

        urgency = int(data.get("urgency") or 5)
        raw_req = data.get("required_resources") or ["ambulance"]

        req_enums: List[ResourceType] = []
        for r in raw_req:
            try:
                req_enums.append(ResourceType(str(r).lower()))
            except ValueError:
                pass

        if not req_enums:
            req_enums = [ResourceType.ambulance]

        waiting_time = float(data.get("waiting_time") or data.get("waiting_time_minutes") or 0.0)

        return Incident(
            id=inc_id,
            type=itype,
            description=desc,
            latitude=float(lat or self.s.city_center[0]),
            longitude=float(lon or self.s.city_center[1]),
            severity=Severity(sev_str),
            urgency=urgency,
            required_resources=req_enums,
            created_at=now,
            waiting_time=waiting_time,
        )

    def _to_resource_model(self, item: Any) -> Optional[Resource]:
        """Convert raw resource data into models.schemas.Resource."""
        if isinstance(item, Resource):
            return item

        if hasattr(item, "model_dump"):
            data = item.model_dump()
        elif isinstance(item, dict):
            data = dict(item)
        else:
            data = vars(item)

        res_id = str(data.get("id") or data.get("resource_id") or "RES-001")
        type_str = str(data.get("type") or "ambulance").lower()
        try:
            res_type = ResourceType(type_str)
        except ValueError:
            return None

        status_str = str(data.get("status") or "available").lower()
        try:
            res_status = ResourceStatus(status_str)
        except ValueError:
            res_status = ResourceStatus.available

        lat = data.get("latitude") or self.s.city_center[0]
        lon = data.get("longitude") or self.s.city_center[1]

        capabilities = data.get("capabilities") or self.s.default_capabilities.get(
            res_type.value, [res_type.value]
        )

        return Resource(
            id=res_id,
            type=res_type,
            latitude=float(lat),
            longitude=float(lon),
            status=res_status,
            capabilities=[str(c).lower() for c in capabilities],
        )

    # -------------------------------------------------------------------------
    # Transform Optimizer Result to Structured Models & Rich Explainability
    # -------------------------------------------------------------------------

    def _build_allocation_result(
        self,
        incidents: List[Incident],
        resources: List[Resource],
        priorities: Dict[str, float],
        priority_breakdowns: Dict[str, Dict[str, Any]],
        opt_result: OptimizationResult,
        now: datetime,
    ) -> ResourceAllocation:
        """Map PuLP/CBC chosen assignments and shortages into the ResourceAllocation schema with complete explainability."""
        inc_by_id = {i.id: i for i in incidents}
        res_by_id = {r.id: r for r in resources}
        holder = {c.resource_id: c.incident_id for c in opt_result.chosen}

        assignments: List[ResourceAssignment] = []

        for c in sorted(opt_result.chosen, key=lambda c: (c.incident_id, c.resource_id)):
            inc = inc_by_id[c.incident_id]
            res = res_by_id[c.resource_id]
            pb = priority_breakdowns[inc.id]
            label = c.resource_type.value.replace("_", " ")

            cands = opt_result.slot_candidates.get(c.slot_key, [])
            nearest = cands[0] if cands else c
            competing_ids = [cand.resource_id for cand in cands if cand.resource_id != c.resource_id]

            # Build rich, structured explainability string
            reason_parts = [
                f"{c.resource_id} is {res.status.value} and compatible ({label}, capabilities: {res.capabilities})."
            ]

            if nearest.resource_id == c.resource_id:
                reason_parts.append(
                    f"Selected as the nearest available {label} to {inc.id} (Distance: {c.distance_km} km, ETA: {c.eta_min} min)."
                )
            else:
                other_inc_id = holder.get(nearest.resource_id)
                if other_inc_id and other_inc_id != inc.id:
                    other_pb = priority_breakdowns.get(other_inc_id, {})
                    reason_parts.append(
                        f"Nearer unit {nearest.resource_id} (ETA: {nearest.eta_min} min) was allocated to {other_inc_id} "
                        f"(Priority: {other_pb.get('effective_priority', priorities.get(other_inc_id, 0.0)):.1f}) by global PuLP optimization."
                    )
                else:
                    reason_parts.append(
                        f"Selected by PuLP solver over {nearest.resource_id} (ETA: {nearest.eta_min} min) "
                        f"to maximize global multi-incident objective and maintain assignment stability."
                    )

            if competing_ids:
                reason_parts.append(f"Other candidates evaluated: {', '.join(competing_ids)}.")

            # Priority & Equity Contribution explainability
            equity_str = f" +{pb['waiting_bonus']:.1f} fairness bonus ({pb['waiting_minutes']:.0f} min wait)" if pb['waiting_bonus'] > 0 else " (+0.0 min wait bonus)"
            reason_parts.append(
                f"Incident Context: {inc.id} is {inc.severity.value.upper()} (Urgency: {inc.urgency}/10). "
                f"Priority Breakdown: Base {pb['severity_base']:.0f}{equity_str} -> Effective Priority: {pb['effective_priority']:.1f}."
            )

            full_reason = " ".join(reason_parts)

            assignments.append(
                ResourceAssignment(
                    resource_id=c.resource_id,
                    resource_type=c.resource_type.value,
                    resource_name=res.id,
                    incident_id=c.incident_id,
                    status="assigned",
                    eta_minutes=c.eta_min,
                    distance_km=c.distance_km,
                    reason=full_reason,
                )
            )

        # Unallocated / missing resources calculation
        all_missing_types: List[str] = []
        unassigned_incidents: List[str] = []
        allocations_by_incident: Dict[str, Any] = {}

        for inc in incidents:
            missing_for_inc = [t.value for t in opt_result.missing.get(inc.id, [])]
            inc_assignments = [a for a in assignments if a.incident_id == inc.id]
            pb = priority_breakdowns[inc.id]

            all_missing_types.extend(missing_for_inc)

            if len(missing_for_inc) == 0 and len(inc_assignments) > 0:
                inc_status = "fully_allocated"
            elif len(inc_assignments) > 0:
                inc_status = "partially_allocated"
                unassigned_incidents.append(inc.id)
            else:
                inc_status = "unallocated"
                unassigned_incidents.append(inc.id)

            allocations_by_incident[inc.id] = {
                "incident_id": inc.id,
                "status": inc_status,
                "allocated_count": len(inc_assignments),
                "missing_resources": missing_for_inc,
                "effective_priority": pb["effective_priority"],
                "waiting_bonus": pb["waiting_bonus"],
                "waiting_minutes": pb["waiting_minutes"],
            }

        primary_inc_id = incidents[0].id if incidents else "INC-001"

        if len(unassigned_incidents) == 0 and len(assignments) > 0:
            overall_status = "fully_allocated"
            overall_reasoning = (
                f"PuLP/CBC solver achieved Optimal global solution (Objective Value: {opt_result.objective_value}). "
                f"All {len(assignments)} required resource slot(s) across {len(incidents)} incident(s) are fully covered."
            )
        elif len(assignments) > 0:
            overall_status = "partially_allocated"
            overall_reasoning = (
                f"PuLP/CBC solver assigned {len(assignments)} unit(s) with objective value {opt_result.objective_value}. "
                f"Shortages detected for: {', '.join(set(all_missing_types))}. "
                f"Unassigned / partial incidents: {', '.join(unassigned_incidents)}."
            )
        else:
            overall_status = "unallocated"
            overall_reasoning = (
                f"PuLP/CBC solver could not allocate any units (no feasible candidates). "
                f"Missing required resources: {', '.join(set(all_missing_types))}."
            )

        return ResourceAllocation(
            incident_id=primary_inc_id,
            allocated_resources=assignments,
            unallocated_resource_types=list(dict.fromkeys(all_missing_types)),
            missing_resources=list(dict.fromkeys(all_missing_types)),
            unassigned_incidents=unassigned_incidents,
            allocations_by_incident=allocations_by_incident,
            allocation_status=overall_status,
            reasoning=overall_reasoning,
            total_allocated=len(assignments),
            allocated_at=now,
        )

    def _handle_solver_failure(
        self, incidents: List[Incident], error_message: str, now: datetime
    ) -> AgentResult:
        """Gracefully return shortage and unassigned state on solver failure instead of crashing."""
        all_missing = [r.value for inc in incidents for r in inc.required_resources]
        unassigned_ids = [inc.id for inc in incidents]

        allocation = ResourceAllocation(
            incident_id=incidents[0].id if incidents else "INC-001",
            allocated_resources=[],
            unallocated_resource_types=list(dict.fromkeys(all_missing)),
            missing_resources=list(dict.fromkeys(all_missing)),
            unassigned_incidents=unassigned_ids,
            allocation_status="unallocated",
            reasoning=f"Mathematical optimization solver could not generate a feasible plan: {error_message}",
            total_allocated=0,
            allocated_at=now,
        )

        return self._success_result(
            data=allocation,
            message=f"Solver could not produce allocation: {error_message}",
        )
