"""Resource Allocation Agent: NO LLM. Delegates every decision to PuLP/CBC and turns the
solver output into assignments with data-backed reasons."""
from dataclasses import dataclass
from datetime import datetime

from config import Settings
from models.schemas import Assignment, Incident, Resource, UnassignedIncident
from optimization.resource_optimizer import ResourceOptimizer
from services.priority_service import PriorityService
from services.route_service import RouteService


@dataclass
class AllocationOutcome:
    assignments: list
    unassigned: list
    objective_value: float
    status: str
    priorities: dict


class ResourceAllocationAgent:
    def __init__(self, settings: Settings, route: RouteService, priority: PriorityService,
                 optimizer: ResourceOptimizer):
        self.s, self.route, self.priority, self.optimizer = settings, route, priority, optimizer

    def allocate(self, incidents: list[Incident], resources: list[Resource], previous_pairs: set,
                 now: datetime) -> AllocationOutcome:
        priorities = {i.id: self.priority.effective_priority(i) for i in incidents}
        res = self.optimizer.solve(incidents, resources, priorities, previous_pairs)
        inc_by_id = {i.id: i for i in incidents}
        holder = {c.resource_id: c.incident_id for c in res.chosen}
        status_of = {r.id: r.status.value for r in resources}

        assignments = []
        for c in sorted(res.chosen, key=lambda c: (c.incident_id, c.resource_id)):
            inc = inc_by_id[c.incident_id]
            label = c.resource_type.value.replace("_", " ")
            cands = res.slot_candidates[c.slot_key]
            nearest = cands[0]
            reason = (f"{c.resource_id} is {'available' if status_of[c.resource_id] == 'available' else 'operational'} "
                      f"and compatible ({label}). ")
            if nearest.resource_id == c.resource_id:
                reason += f"It is the nearest compatible {label} to {inc.id} ({c.distance_km} km, ETA {c.eta_min} min). "
            else:
                other = holder.get(nearest.resource_id)
                if other and other != inc.id:
                    reason += (f"Nearer {nearest.resource_id} (ETA {nearest.eta_min} min) was allocated to {other} "
                               f"(priority {priorities[other]:.0f}) by the global optimization. ")
                else:
                    reason += (f"Chosen by the optimizer over nearer {nearest.resource_id} "
                               f"(ETA {nearest.eta_min} min) to keep the overall plan optimal or stable. ")
            reason += (f"{inc.id} is {inc.severity.value} with effective priority {priorities[inc.id]:.0f} "
                       f"(waiting {inc.waiting_time:.0f} min).")
            assignments.append(Assignment(
                id=f"ASN-{c.incident_id}-{c.resource_id}", incident_id=c.incident_id, resource_id=c.resource_id,
                resource_type=c.resource_type, distance=c.distance_km, eta=c.eta_min, status="assigned",
                reason=reason, created_at=now))

        unassigned = []
        for inc_id, missing in sorted(res.missing.items()):
            no_supply, parts = [], []
            for t in missing:
                pool = [k for k in res.slot_candidates if k.startswith(f"{inc_id}:{t.value}:")]
                supply = len(res.slot_candidates[pool[0]]) if pool else 0
                if supply == 0:
                    no_supply.append(t)
                    parts.append(f"No available {t.value.replace('_', ' ')} for {inc_id}.")
                else:
                    parts.append(f"All {supply} eligible {t.value.replace('_', ' ')} unit(s) were allocated to "
                                 f"higher-value work; {inc_id} still needs one.")
            unassigned.append(UnassignedIncident(incident_id=inc_id, missing_resources=missing,
                                                 no_supply_types=no_supply, reason=" ".join(parts)))
        return AllocationOutcome(assignments, unassigned, res.objective_value, res.status, priorities)
