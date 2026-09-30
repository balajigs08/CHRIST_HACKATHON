"""Command & Planning Agent: owns global state, reacts to events, orchestrates the other agents,
diffs plans, writes explanations + audit events, and raises human-approval requests.
It never chooses assignments itself - that is the optimizer's job."""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.resource_allocation_agent import ResourceAllocationAgent
from config import Settings
from events.event_log import EventLog
from events.ws_manager import ConnectionManager
from models.errors import Conflict, CrisisError, OptimizationError
from models.schemas import (Approval, ApprovalStatus, EventType, Incident, IncidentCreate, IncidentStatus,
                            IncidentUpdate, PlanHistoryEntry, Resource, ResourceCreate, ResourceStatus,
                            ResourceUpdate, ResponsePlan, Severity)
from services import simulation_service as sim
from services.clock import SimClock
from services.plan_diff import build_explanation, diff_plans
from services.state_store import StateStore

logger = logging.getLogger("crisis-command.agent")
_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
_DOWN = (ResourceStatus.unavailable, ResourceStatus.maintenance)


class CommandPlanningAgent:
    def __init__(self, store: StateStore, log: EventLog, ws: ConnectionManager,
                 assessor: IncidentAssessmentAgent, allocator: ResourceAllocationAgent,
                 clock: SimClock, settings: Settings, persistence=None):
        self.store, self.log, self.ws = store, log, ws
        self.persistence = persistence  # MongoPersistence (None = memory only)
        self.assessor, self.allocator, self.clock, self.s = assessor, allocator, clock, settings
        self._lock = asyncio.Lock()
        self._pending: list = []
        self.store.current_plan = self._empty_plan()

    # ------------------------------------------------------------------ infra
    def _empty_plan(self) -> ResponsePlan:
        return ResponsePlan(plan_id="PLN000", created_at=self.clock.now(),
                            explanation="No plan yet. Report an incident to start the response.")

    def _emit(self, etype: EventType, description: str, affected=None, previous=None, new=None, reason=None):
        ev = self.log.record(etype, self.clock.now(), description, affected, previous, new, reason)
        self._pending.append(ev)
        return ev

    async def _persist(self) -> None:
        """Write the changes of the finished operation to MongoDB (never raises; see MongoPersistence.save)."""
        if self.persistence is not None:
            await asyncio.to_thread(self.persistence.save, self.store, self.log, self.clock)

    @asynccontextmanager
    async def _operation(self):
        """Serialise mutations; persist them, then broadcast the events + fresh snapshot."""
        async with self._lock:
            self._pending = []
            try:
                yield
            finally:
                events, self._pending = self._pending, []
                await self._persist()  # also after a failed operation, so DB == memory
        if events:
            await self.ws.publish(events, self.snapshot())

    def snapshot(self) -> dict:
        st = self.store
        incs = sorted(st.incidents.values(), key=lambda i: i.id)
        live = [i for i in incs if i.status != IncidentStatus.resolved]
        summary = {s.value: sum(1 for i in live if i.severity == s) for s in Severity}
        summary["waiting"] = sum(1 for i in live if i.status == IncidentStatus.waiting)
        dump = lambda xs: [x.model_dump(mode="json") for x in xs]
        return {
            "system_status": "ONLINE",
            "sim_time": self.clock.now().isoformat(),
            "summary": summary,
            "incidents": dump(incs),
            "resources": dump(sorted(st.resources.values(), key=lambda r: r.id)),
            "plan": st.current_plan.model_dump(mode="json"),
            "plan_history": dump(st.plan_history[-20:]),
            "events": dump(self.log.list(300)),
            "approvals": dump(st.approvals.values()),
        }

    # ------------------------------------------------------------------ incidents
    async def _add_incident(self, p: IncidentCreate, source: str = "operator") -> Incident:
        a = await asyncio.to_thread(self.assessor.assess, p.description, p.latitude, p.longitude)
        now = self.clock.now()
        inc = Incident(
            id=self.store.next_id("INC"), type=p.type or a.incident_type, description=p.description,
            latitude=a.location.latitude, longitude=a.location.longitude, severity=p.severity or a.severity,
            urgency=p.urgency or a.urgency, required_resources=p.required_resources or a.required_resources,
            status=IncidentStatus.assessed, created_at=now, location_name=a.location.name,
            assessment_confidence=a.confidence, assessment_source=a.source, assessment_explanation=a.explanation)
        self.store.incidents[inc.id] = inc
        need = ", ".join(r.value for r in inc.required_resources)
        self._emit(EventType.INCIDENT_CREATED,
                   f"{inc.id} created: {inc.type} ({inc.severity.value}, urgency {inc.urgency}) "
                   f"near {inc.location_name or 'unspecified location'}; needs {need}.",
                   [inc.id], new={"severity": inc.severity.value, "type": inc.type, "source": source},
                   reason=a.explanation)
        return inc

    async def create_incident(self, payload: IncidentCreate, source: str = "operator"):
        async with self._operation():
            inc = await self._add_incident(payload, source)
            plan = await self._replan(f"new {inc.severity.value} incident {inc.id} ({inc.type})")
            return self.store.incidents[inc.id], plan

    async def update_incident(self, iid: str, u: IncidentUpdate):
        async with self._operation():
            inc = self.store.get_incident(iid)
            if inc.status == IncidentStatus.resolved:
                raise Conflict("incident_resolved", f"{iid} is already resolved.")
            if u.status is not None and u.status not in (IncidentStatus.resolved, IncidentStatus.active, inc.status):
                raise CrisisError(422, "invalid_status",
                                  "Operators may set 'active' or 'resolved'; other statuses are managed by the planner.")
            before = {"severity": inc.severity.value, "urgency": inc.urgency, "status": inc.status.value}
            escalated = u.severity is not None and _RANK[u.severity.value] > _RANK[inc.severity.value]
            for f in ("description", "latitude", "longitude", "severity", "urgency", "required_resources"):
                v = getattr(u, f)
                if v is not None:
                    setattr(inc, f, v)
            if u.status is not None:
                inc.status = u.status
            if inc.status == IncidentStatus.resolved:
                inc.assigned_resources, inc.missing_resources = [], []
            after = {"severity": inc.severity.value, "urgency": inc.urgency, "status": inc.status.value}
            self._emit(EventType.INCIDENT_ESCALATED if escalated else EventType.INCIDENT_UPDATED,
                       f"{iid} {'escalated' if escalated else 'updated'}: {before} -> {after}",
                       [iid], before, after)
            plan = await self._replan(f"{iid} {'escalated' if escalated else 'updated'}")
            return self.store.incidents[iid], plan

    # ------------------------------------------------------------------ resources
    def _mark_unavailable(self, rid: str, reason: str, status=ResourceStatus.unavailable) -> list:
        r = self.store.get_resource(rid)
        if r.status in _DOWN:
            raise Conflict("resource_already_unavailable", f"{rid} is already {r.status.value}.")
        affected = sorted({a.incident_id for a in self.store.assignments if a.resource_id == rid})
        prev = {"status": r.status.value, "assignment": r.current_assignment}
        r.status, r.current_assignment, r.eta, r.status_reason = status, None, None, reason
        tail = f" Affected incident(s): {', '.join(affected)}." if affected else ""
        self._emit(EventType.RESOURCE_UNAVAILABLE, f"{rid} became {status.value}: {reason}.{tail}",
                   [rid] + affected, prev, {"status": status.value}, reason)
        return affected

    def _mark_available(self, rid: str) -> None:
        r = self.store.get_resource(rid)
        if r.status not in _DOWN:
            raise Conflict("resource_not_unavailable", f"{rid} is {r.status.value}, not unavailable.")
        prev = {"status": r.status.value}
        r.status, r.status_reason = ResourceStatus.available, None
        self._emit(EventType.RESOURCE_AVAILABLE, f"{rid} is available again.", [rid], prev, {"status": "available"})

    async def resource_unavailable(self, rid: str, reason: str):
        async with self._operation():
            self._mark_unavailable(rid, reason)
            return await self._replan(f"{rid} became unavailable ({reason})")

    async def resource_available(self, rid: str):
        async with self._operation():
            self._mark_available(rid)
            return await self._replan(f"{rid} became available again")

    async def create_resource(self, p: ResourceCreate) -> Resource:
        async with self._operation():
            caps = p.capabilities if p.capabilities is not None else list(self.s.default_capabilities[p.type.value])
            if p.status == ResourceStatus.assigned:
                raise CrisisError(422, "invalid_status", "'assigned' is set only by the planner.")
            if self.s.required_capability[p.type.value] not in caps:
                raise CrisisError(422, "invalid_capabilities",
                                  f"A {p.type.value} needs capability '{self.s.required_capability[p.type.value]}'.")
            rid = p.id or self.store.new_resource_id(p.type)
            res = Resource(id=rid, type=p.type, latitude=p.latitude, longitude=p.longitude,
                           status=p.status, capabilities=caps)
            self.store.add_resource(res)
            self._emit(EventType.RESOURCE_AVAILABLE, f"{rid} ({p.type.value}) registered as {p.status.value}.",
                       [rid], None, {"status": p.status.value})
            await self._replan(f"resource {rid} registered")
            return res

    async def update_resource(self, rid: str, u: ResourceUpdate):
        async with self._operation():
            r = self.store.get_resource(rid)
            if u.status == ResourceStatus.assigned:
                raise CrisisError(422, "invalid_status", "'assigned' is set only by the planner.")
            trigger = f"{rid} updated"
            if u.status in _DOWN:
                self._mark_unavailable(rid, u.reason or "Set by operator", u.status)
                trigger = f"{rid} became {u.status.value}"
            elif u.status == ResourceStatus.available and r.status in _DOWN:
                self._mark_available(rid)
                trigger = f"{rid} became available again"
            changed = {}
            for f in ("latitude", "longitude", "capabilities"):
                v = getattr(u, f)
                if v is not None and v != getattr(r, f):
                    changed[f] = v
                    setattr(r, f, v)
            if changed:
                self._emit(EventType.RESOURCE_UPDATED, f"{rid} updated: {changed}", [rid], None, changed)
            return r, await self._replan(trigger)

    # ------------------------------------------------------------------ planning
    async def recalculate(self, trigger: str = "operator requested recalculation"):
        async with self._operation():
            return await self._replan(trigger)

    async def advance_time(self, minutes: float):
        async with self._operation():
            self.clock.advance(minutes)
            self._emit(EventType.TIME_ADVANCED, f"Simulation clock advanced by {minutes:g} minutes.", [],
                       reason="Waiting-time bonuses are recalculated")
            return await self._replan(f"simulation clock advanced {minutes:g} min; waiting-time priorities updated")

    async def _replan(self, trigger: str) -> ResponsePlan:
        st = self.store
        now = self.clock.now()
        st.refresh_waiting(now)
        incidents = st.active_incidents()
        prev = list(st.assignments)
        prev_pairs = {(a.resource_id, a.incident_id) for a in prev}
        self._emit(EventType.PLAN_RECALCULATED, f"Reoptimization started: {trigger}.",
                   [i.id for i in incidents], new={"phase": "started"}, reason=trigger)
        try:
            out = await asyncio.to_thread(
                self.allocator.allocate, [i.model_copy(deep=True) for i in incidents],
                [r.model_copy(deep=True) for r in st.resources.values()], prev_pairs, now)
        except Exception as exc:
            msg = exc.message if isinstance(exc, CrisisError) else str(exc)
            self._emit(EventType.PLAN_RECALCULATED, f"Optimization FAILED: {msg}. Previous plan retained.",
                       new={"phase": "failed"}, reason=msg)
            raise exc if isinstance(exc, CrisisError) else OptimizationError(msg)

        created = {(a.resource_id, a.incident_id): a.created_at for a in prev}
        for a in out.assignments:
            a.created_at = created.get((a.resource_id, a.incident_id), a.created_at)
        st.assignments = out.assignments

        by_inc: dict = {}
        for a in out.assignments:
            by_inc.setdefault(a.incident_id, []).append(a)
        missing = {u.incident_id: u.missing_resources for u in out.unassigned}
        for inc in incidents:
            inc.assigned_resources = [a.resource_id for a in by_inc.get(inc.id, [])]
            inc.missing_resources = missing.get(inc.id, [])
            inc.effective_priority = out.priorities[inc.id]
            if inc.assigned_resources and not inc.missing_resources:
                inc.status = IncidentStatus.active if inc.status == IncidentStatus.active else IncidentStatus.assigned
            else:
                inc.status = IncidentStatus.waiting
        held = {a.resource_id: a for a in out.assignments}
        for r in st.resources.values():
            if r.status in (ResourceStatus.available, ResourceStatus.assigned):
                a = held.get(r.id)
                r.status = ResourceStatus.assigned if a else ResourceStatus.available
                r.current_assignment = a.incident_id if a else None
                r.eta = a.eta if a else None

        changes = diff_plans(prev, out.assignments, st.resources, st.incidents)
        for c in changes:
            if c.kind in ("assigned", "reallocated"):
                a = held[c.resource_id]
                self._emit(EventType.RESOURCE_ASSIGNED if c.kind == "assigned" else EventType.RESOURCE_REALLOCATED,
                           c.text.split(". ")[0] + ".", [c.resource_id, a.incident_id] +
                           ([c.from_incident] if c.from_incident else []),
                           {"incident": c.from_incident}, {"incident": a.incident_id, "eta": a.eta,
                                                           "distance": a.distance}, c.text)
            elif c.kind == "released":
                self._emit(EventType.RESOURCE_AVAILABLE, c.text, [c.resource_id, c.from_incident])

        plan = ResponsePlan(plan_id=st.next_id("PLN"), created_at=now, assignments=out.assignments,
                            unassigned_incidents=out.unassigned, objective_value=out.objective_value,
                            optimization_status=out.status, trigger=trigger, changes=changes)
        note = self._handle_shortage(plan)
        plan.human_approval_required = bool(st.pending_approvals())
        plan.explanation = build_explanation(trigger, changes, out.unassigned, st.incidents, note)
        st.current_plan = plan
        active_ids = {i.id for i in incidents}
        st.plan_history.append(PlanHistoryEntry(
            plan_id=plan.plan_id, created_at=now, trigger=trigger,
            previous=[{"incident_id": a.incident_id, "resource_id": a.resource_id}
                      for a in prev if a.incident_id in active_ids],
            new=[{"incident_id": a.incident_id, "resource_id": a.resource_id} for a in out.assignments],
            changes=changes, reason=plan.explanation))
        self._emit(EventType.PLAN_RECALCULATED,
                   f"Plan {plan.plan_id} generated: {len(out.assignments)} assignment(s), "
                   f"{len(out.unassigned)} incident(s) not fully covered (objective {out.objective_value}).",
                   [plan.plan_id], new={"phase": "completed", "objective": out.objective_value,
                                        "status": out.status}, reason=plan.explanation)
        return plan

    # ------------------------------------------------------------------ human approval
    def _handle_shortage(self, plan: ResponsePlan) -> str:
        st, now = self.store, self.clock.now()
        missing = {u.incident_id: sorted(t.value for t in u.missing_resources) for u in plan.unassigned_incidents}
        sig = "|".join(f"{i}:{','.join(ts)}" for i, ts in sorted(missing.items()))
        pending = st.pending_approvals()
        if sig in st.acknowledged:
            ap = st.approvals[st.acknowledged[sig]]
            return f"Shortage already reviewed by operator ({ap.id}: {ap.status.value})."
        for ap in pending:
            if ap.signature == sig:
                ap.plan_id = plan.plan_id
                return ""
            ap.status, ap.resolved_at = ApprovalStatus.superseded, now
            ap.note = "Shortage changed after replanning" if missing else "Shortage resolved by replanning"
            self._emit(EventType.PLAN_RECALCULATED, f"Approval {ap.id} superseded: {ap.note}.", [ap.id])
        if not missing:
            return ""
        reason = " ".join(u.reason for u in plan.unassigned_incidents)
        need = "; ".join(f"{t.replace('_', ' ')} for {i}" for i, ts in sorted(missing.items()) for t in ts)
        ap = Approval(id=st.next_id("APR"), plan_id=plan.plan_id, reason=reason,
                      recommended_action=f"Request external assistance ({need}).",
                      incident_ids=sorted(missing), missing=missing, signature=sig, created_at=now)
        st.approvals[ap.id] = ap
        self._emit(EventType.HUMAN_APPROVAL_REQUIRED, f"HUMAN APPROVAL REQUIRED ({ap.id}): {reason}",
                   [ap.id] + sorted(missing), new={"missing": missing}, reason=ap.recommended_action)
        zero = sorted({t.value.replace("_", " ") for u in plan.unassigned_incidents for t in u.no_supply_types})
        if zero:
            self._emit(EventType.BOUNDARY_COLLAPSE,
                       f"BOUNDARY COLLAPSE: no available {', '.join(zero)} left in the system. "
                       f"No unit was invented; external assistance is required.",
                       sorted(missing), new={"missing_types": zero})
        return ""

    async def decide(self, approve: bool, approval_id: Optional[str] = None, note: Optional[str] = None):
        async with self._operation():
            st = self.store
            if approval_id:
                if approval_id not in st.approvals:
                    raise CrisisError(404, "approval_not_found", f"Approval '{approval_id}' does not exist.")
                ap = st.approvals[approval_id]
            else:
                pend = st.pending_approvals()
                if not pend:
                    raise Conflict("no_pending_approval", "There is no pending approval.")
                ap = pend[-1]
            if ap.status != ApprovalStatus.pending:
                raise Conflict("approval_conflict", f"{ap.id} was already {ap.status.value}.")
            ap.status = ApprovalStatus.approved if approve else ApprovalStatus.rejected
            ap.resolved_at, ap.note = self.clock.now(), note
            st.acknowledged[ap.signature] = ap.id
            verb = "APPROVED" if approve else "REJECTED"
            for iid in ap.incident_ids:
                if iid in st.incidents:
                    st.incidents[iid].notes.append(
                        f"{ap.id} {verb.lower()}" + (": external assistance requested" if approve else ""))
            self._emit(EventType.APPROVAL_APPROVED if approve else EventType.APPROVAL_REJECTED,
                       f"Operator {verb} {ap.id}. " + (
                           f"External assistance requested: {ap.recommended_action}" if approve else
                           "External assistance declined; incidents stay queued."),
                       [ap.id] + ap.incident_ids, {"status": "pending"}, {"status": ap.status.value}, note)
            plan = st.current_plan
            plan.human_approval_required = bool(st.pending_approvals())
            plan.explanation += f" Operator {verb.lower()} {ap.id}."
            return ap

    # ------------------------------------------------------------------ simulation helpers
    async def sim_incident(self, kind: str):
        if kind not in sim.TEMPLATES:
            raise CrisisError(422, "invalid_kind", f"Unknown incident kind '{kind}'. Use {list(sim.TEMPLATES)}.")
        return await self.create_incident(IncidentCreate(description=sim.random_incident_text(kind)),
                                          source="simulation")

    async def break_ambulance(self):
        async with self._operation():
            amb = sorted((r for r in self.store.resources.values() if r.type.value == "ambulance"
                          and r.status not in _DOWN), key=lambda r: (r.status != ResourceStatus.assigned, r.id))
            if not amb:
                raise Conflict("no_ambulance", "No operational ambulance left to break.")
            self._mark_unavailable(amb[0].id, "Mechanical breakdown (simulated)")
            return await self._replan(f"{amb[0].id} became unavailable (Mechanical breakdown)")

    async def restore_ambulance(self):
        async with self._operation():
            down = sorted(r.id for r in self.store.resources.values()
                          if r.type.value == "ambulance" and r.status in _DOWN)
            if not down:
                raise Conflict("no_unavailable_ambulance", "No unavailable ambulance to restore.")
            self._mark_available(down[0])
            return await self._replan(f"{down[0]} became available again")

    async def demo_t0(self):
        async with self._operation():
            ids = [(await self._add_incident(IncidentCreate(description=t), "simulation")).id for t in sim.DEMO_T0]
            return await self._replan(f"initial scenario: {', '.join(ids)} reported")

    async def demo_t10(self):
        async with self._operation():
            self.clock.advance(10)
            self._emit(EventType.TIME_ADVANCED, "Simulation clock advanced by 10 minutes (T+10).", [])
            inc = await self._add_incident(IncidentCreate(description=sim.DEMO_T10), "simulation")
            trigger = f"new {inc.severity.value} incident {inc.id} ({inc.type})"
            if self.store.get_resource("A01").status not in _DOWN:
                self._mark_unavailable("A01", "Mechanical breakdown (simulated)")
                trigger += " and A01 became unavailable"
            return await self._replan(trigger)

    async def reset(self):
        async with self._operation():
            self.clock.reset()
            self.store.reset()
            self.log.clear()
            self.store.current_plan = self._empty_plan()
            if self.persistence is not None:
                self.persistence.mark_reset()
            self._emit(EventType.SCENARIO_RESET, "Scenario reset: incidents cleared, resources restored.", [])
