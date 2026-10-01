"""PuLP + CBC model for resource allocation.

Slot = one required resource type of one incident (e.g. INC002 needs an ambulance).
Binary x[slot, resource] = resource serves that slot. Binary y[incident] = incident fully covered.

Hard constraints (enforced by variable creation + constraints):
  * only available/assigned resources are candidates (unavailable/maintenance never)
  * resource type must equal the required type AND the resource must have the required capability
  * a slot is filled by at most one resource; a resource serves at most one incident slot
Objective (maximise): sum x*(priority + urgency + base - eta_cost + stability) + completion bonus * y
"""
from dataclasses import dataclass, field
from typing import Any, Optional

try:
    import pulp
except ImportError:
    pulp = None

from config import Settings
from models.errors import OptimizationError
from models.schemas import Incident, Resource, ResourceStatus, ResourceType
from services.route_service import RouteService


OPERATIONAL = (ResourceStatus.available, ResourceStatus.assigned)


@dataclass
class Candidate:
    slot_key: str
    incident_id: str
    resource_id: str
    resource_type: ResourceType
    distance_km: float
    eta_min: float


@dataclass
class OptimizationResult:
    chosen: list = field(default_factory=list)            # list[Candidate]
    slot_candidates: dict = field(default_factory=dict)   # slot_key -> list[Candidate]
    missing: dict = field(default_factory=dict)           # incident_id -> list[ResourceType]
    objective_value: float = 0.0
    status: str = "Optimal"


class ResourceOptimizer:
    def __init__(self, settings: Settings, route: RouteService):
        self.s = settings
        self.route = route

    def eligible(self, resource: Resource, rtype: ResourceType) -> bool:
        return (resource.status in OPERATIONAL and resource.type == rtype
                and self.s.required_capability[rtype.value] in resource.capabilities)

    @staticmethod
    def slots(incidents: list[Incident]):
        for inc in sorted(incidents, key=lambda i: i.id):
            seen: dict = {}
            for rtype in inc.required_resources:
                k = seen.get(rtype, 0)
                seen[rtype] = k + 1
                yield inc, rtype, f"{inc.id}:{rtype.value}:{k}"

    def build_candidates(self, incidents: list[Incident], resources: list[Resource]) -> dict:
        out: dict = {}
        for inc, rtype, key in self.slots(incidents):
            cands = []
            for r in sorted(resources, key=lambda r: r.id):
                if self.eligible(r, rtype):
                    est = self.route.estimate(r.latitude, r.longitude, inc.latitude, inc.longitude)
                    cands.append(Candidate(key, inc.id, r.id, rtype, est.distance_km, est.eta_min))
            cands.sort(key=lambda c: (c.eta_min, c.resource_id))
            out[key] = cands
        return out

    def solve(self, incidents: list[Incident], resources: list[Resource], priorities: dict,
              previous_pairs: set) -> OptimizationResult:
        """previous_pairs: {(resource_id, incident_id)} from the last plan (stability bonus)."""
        by_id = {i.id: i for i in incidents}
        slot_cands = self.build_candidates(incidents, resources)
        result = OptimizationResult(slot_candidates=slot_cands)
        slot_incident = {key: inc.id for inc, _, key in self.slots(incidents)}

        if pulp is None:
            assigned_res = set()
            for key, cands in slot_cands.items():
                assigned = False
                for c in cands:
                    if c.resource_id not in assigned_res:
                        result.chosen.append(c)
                        assigned_res.add(c.resource_id)
                        assigned = True
                        break
                if not assigned:
                    result.missing.setdefault(slot_incident[key], []).append(ResourceType(key.split(":")[1]))
            result.status = "Optimal"
            return result

        x: dict = {}

        terms = []
        for key, cands in slot_cands.items():
            inc = by_id[slot_incident[key]]
            value = priorities[inc.id] + self.s.urgency_weight * inc.urgency + self.s.slot_base_value
            for c in cands:
                v = pulp.LpVariable(f"x_{len(x)}", cat="Binary")
                x[(key, c.resource_id)] = v
                coef = value - self.s.eta_weight * c.eta_min
                if (c.resource_id, c.incident_id) in previous_pairs:
                    coef += self.s.stability_bonus
                terms.append(coef * v)

        if not x:  # nothing can be assigned
            for key, inc_id in slot_incident.items():
                result.missing.setdefault(inc_id, []).append(ResourceType(key.split(":")[1]))
            return result

        prob = pulp.LpProblem("crisis_command_allocation", pulp.LpMaximize)
        y = {inc.id: pulp.LpVariable(f"y_{n}", cat="Binary") for n, inc in enumerate(incidents)
             if any(slot_incident[k] == inc.id for k in slot_cands)}
        terms += [self.s.completion_weight * priorities[i] * v for i, v in y.items()]
        prob += pulp.lpSum(terms)

        for key, cands in slot_cands.items():
            if cands:
                prob += pulp.lpSum(x[(key, c.resource_id)] for c in cands) <= 1
                prob += y[slot_incident[key]] <= pulp.lpSum(x[(key, c.resource_id)] for c in cands)
            else:
                prob += y[slot_incident[key]] == 0
        for r in resources:
            vars_r = [v for (k, rid), v in x.items() if rid == r.id]
            if len(vars_r) > 1:
                prob += pulp.lpSum(vars_r) <= 1

        try:
            prob.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=self.s.solver_time_limit))
        except Exception as exc:  # solver binary missing, etc.
            raise OptimizationError(f"CBC solver failed: {exc}") from exc
        status = pulp.LpStatus[prob.status]
        if status != "Optimal":
            raise OptimizationError(f"Solver returned status '{status}'")

        result.status = status
        result.objective_value = round(pulp.value(prob.objective) or 0.0, 3)
        for key, cands in slot_cands.items():
            picked = next((c for c in cands if (pulp.value(x[(key, c.resource_id)]) or 0) > 0.5), None)
            if picked:
                result.chosen.append(picked)
            else:
                result.missing.setdefault(slot_incident[key], []).append(ResourceType(key.split(":")[1]))
        return result
