"""In-memory working set of the global state. It is persisted to / restored from MongoDB by
`db.mongo.MongoPersistence`; the agents keep mutating these objects exactly as before."""
from datetime import datetime
from typing import Callable, Optional

from config import Settings
from data.seed import initial_resources
from models.errors import Conflict, NotFound
from models.schemas import (Approval, Assignment, Incident, IncidentStatus, PlanHistoryEntry, Resource,
                            ResourceType, ResponsePlan)

_PREFIX = {"ambulance": "A", "fire_team": "F", "rescue_team": "R", "medical_unit": "M", "shelter": "S"}


class StateStore:
    def __init__(self, settings: Settings, seed: Callable = initial_resources):
        self.settings, self._seed = settings, seed
        self.reset()

    def reset(self) -> None:
        self.incidents: dict[str, Incident] = {}
        self.resources: dict[str, Resource] = {r.id: r for r in self._seed(self.settings)}
        self.assignments: list[Assignment] = []
        self.current_plan: Optional[ResponsePlan] = None
        self.plan_history: list[PlanHistoryEntry] = []
        self.approvals: dict[str, Approval] = {}
        self.acknowledged: dict[str, str] = {}  # shortage signature -> approval id
        self._counters: dict[str, int] = {}

    def dump_counters(self) -> dict:
        return dict(self._counters)

    def load_counters(self, counters: dict) -> None:
        self._counters = {k: int(v) for k, v in counters.items()}

    def next_id(self, prefix: str, width: int = 3) -> str:
        self._counters[prefix] = self._counters.get(prefix, 0) + 1
        return f"{prefix}{self._counters[prefix]:0{width}d}"

    def new_resource_id(self, rtype: ResourceType) -> str:
        p = _PREFIX[rtype.value]
        n = 1
        while f"{p}{n:02d}" in self.resources:
            n += 1
        return f"{p}{n:02d}"

    def get_incident(self, iid: str) -> Incident:
        if iid not in self.incidents:
            raise NotFound("incident_not_found", f"Incident '{iid}' does not exist.")
        return self.incidents[iid]

    def get_resource(self, rid: str) -> Resource:
        if rid not in self.resources:
            raise NotFound("resource_not_found", f"Resource '{rid}' does not exist.")
        return self.resources[rid]

    def add_resource(self, res: Resource) -> None:
        if res.id in self.resources:
            raise Conflict("resource_exists", f"Resource '{res.id}' already exists.")
        self.resources[res.id] = res

    def active_incidents(self) -> list[Incident]:
        return [i for i in self.incidents.values() if i.status != IncidentStatus.resolved]

    def refresh_waiting(self, now: datetime) -> None:
        """Waiting time accrues while an incident has no (or only partial) coverage."""
        for i in self.active_incidents():
            if not i.assigned_resources or i.missing_resources:
                i.waiting_time = round(max(0.0, (now - i.created_at).total_seconds() / 60), 1)

    def pending_approvals(self) -> list[Approval]:
        return [a for a in self.approvals.values() if a.status.value == "pending"]
