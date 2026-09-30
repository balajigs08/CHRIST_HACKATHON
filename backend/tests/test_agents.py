"""Core behaviour tests (no HTTP): assessment, optimization, replanning, approvals, explanations."""
from conftest import add, assigned_pairs, event_types, fresh, run
from models.errors import Conflict, CrisisError
from models.schemas import ResourceCreate, ResourceStatus, ResourceType, Severity
from optimization.resource_optimizer import ResourceOptimizer
from services.priority_service import PriorityService
from services.route_service import RouteService

FIRE = "Major building fire near Whitefield. Several people are trapped inside."
ACC = "Two-vehicle collision with injuries reported near Koramangala."
MED = "Medical emergency: elderly patient feeling weak and dizzy near Jayanagar."
COLLAPSE = "Building collapse near Indiranagar. Multiple people trapped under debris."


def raises(exc, fn):
    try:
        fn()
    except exc as e:
        return e
    raise AssertionError(f"{exc.__name__} not raised")


# 1 ---------------------------------------------------------------- incident creation
def test_incident_creation():
    c = fresh()
    inc, plan = add(c, ACC)
    assert inc.id == "INC001" and inc.severity == Severity.high
    assert inc.required_resources == [ResourceType.ambulance]
    assert inc.status.value == "assigned" and len(inc.assigned_resources) == 1
    assert "INCIDENT_CREATED" in event_types(c)


# 2 ---------------------------------------------------------------- assessment
def test_incident_assessment_rules():
    a = fresh().assessor
    r = a.assess(FIRE)
    assert (r.incident_type, r.severity.value, r.urgency) == ("building_fire", "critical", 10)
    assert set(x.value for x in r.required_resources) == {"fire_team", "ambulance"}
    assert abs(r.location.latitude - 12.9698) < 1e-6 and r.source == "rules"
    assert a.assess("Bike crash on the highway").incident_type == "road_accident"
    assert a.assess("Man is unconscious after a heart attack").incident_type == "medical_emergency"
    col = a.assess(COLLAPSE)
    assert col.incident_type == "building_collapse" and col.severity.value == "critical"
    assert [x.value for x in col.required_resources] == ["rescue_team", "ambulance", "medical_unit"]
    unknown = a.assess("Strange noises heard in the neighbourhood")
    assert unknown.incident_type == "general_emergency" and unknown.confidence < 0.5
    # the agent recommends TYPES only: nothing in the output looks like a unit id
    assert all(isinstance(x, ResourceType) for x in col.required_resources)


# 3 ---------------------------------------------------------------- resource creation
def test_resource_creation():
    c = fresh()
    r = run(c.agent.create_resource(ResourceCreate(type=ResourceType.ambulance, latitude=12.95, longitude=77.6)))
    assert r.id == "A04" and r.status == ResourceStatus.available
    e = raises(Conflict, lambda: run(c.agent.create_resource(
        ResourceCreate(id="A04", type=ResourceType.ambulance, latitude=1, longitude=1))))
    assert e.code == "resource_exists"
    e = raises(CrisisError, lambda: run(c.agent.create_resource(
        ResourceCreate(type=ResourceType.ambulance, latitude=1, longitude=1, capabilities=["nothing"]))))
    assert e.code == "invalid_capabilities"


# 4 ---------------------------------------------------------------- availability
def test_resource_availability_cycle():
    c = fresh()
    run(c.agent.resource_unavailable("A01", "flat tyre"))
    assert c.store.resources["A01"].status == ResourceStatus.unavailable
    assert raises(Conflict, lambda: run(c.agent.resource_unavailable("A01", "again"))).code == "resource_already_unavailable"
    run(c.agent.resource_available("A01"))
    assert c.store.resources["A01"].status == ResourceStatus.available
    assert raises(Conflict, lambda: run(c.agent.resource_available("A01"))).code == "resource_not_unavailable"
    assert raises(CrisisError, lambda: run(c.agent.resource_unavailable("ZZZ", "x"))).status_code == 404


# 5 ---------------------------------------------------------------- valid allocation
def test_valid_allocation():
    c = fresh()
    for t in (ACC, FIRE, MED):
        _, plan = add(c, t)
    assert plan.optimization_status == "Optimal"
    inc = c.store.incidents
    for a in plan.assignments:
        res = c.store.resources[a.resource_id]
        assert res.type in inc[a.incident_id].required_resources        # type compatibility
        assert a.reason and a.eta > 0 and a.distance >= 0
    ids = [a.resource_id for a in plan.assignments]
    assert len(ids) == len(set(ids)) == 4                               # 3 ambulances + 1 fire team
    assert not plan.human_approval_required


# 6 ---------------------------------------------------------------- invalid allocation
def test_invalid_allocation_never_happens():
    c = fresh()
    run(c.agent.update_resource("A01", __import__("models.schemas", fromlist=["x"]).ResourceUpdate(
        status=ResourceStatus.maintenance, reason="servicing")))
    run(c.agent.resource_unavailable("A02", "crew sick"))
    _, plan = add(c, ACC)
    assert {a.resource_id for a in plan.assignments} == {"A03"}         # only valid unit
    opt = ResourceOptimizer(c.settings, RouteService(c.settings))
    assert not opt.eligible(c.store.resources["A01"], ResourceType.ambulance)   # maintenance
    assert not opt.eligible(c.store.resources["A02"], ResourceType.ambulance)   # unavailable
    assert not opt.eligible(c.store.resources["F01"], ResourceType.ambulance)   # wrong type
    stripped = c.store.resources["A03"].model_copy(deep=True)
    stripped.capabilities = []
    assert not opt.eligible(stripped, ResourceType.ambulance)                   # missing capability


# 7 ---------------------------------------------------------------- resource conflict
def test_resource_conflict_single_ambulance():
    c = fresh()
    run(c.agent.resource_unavailable("A02", "x"))
    run(c.agent.resource_unavailable("A03", "x"))
    add(c, ACC)
    _, plan = add(c, MED)
    ids = [a.resource_id for a in plan.assignments]
    assert ids == ["A01"]                                               # one unit, one incident
    assert len(plan.unassigned_incidents) == 1


# 8 ---------------------------------------------------------------- critical prioritisation
def test_critical_incident_prioritised():
    c = fresh()
    run(c.agent.resource_unavailable("A02", "x"))
    run(c.agent.resource_unavailable("A03", "x"))
    add(c, MED)                                                          # medium takes A01
    fire, plan = add(c, FIRE)                                            # critical arrives
    amb = [a for a in plan.assignments if a.resource_id == "A01"]
    assert amb and amb[0].incident_id == fire.id                         # A01 re-tasked to the critical one
    assert c.store.incidents["INC001"].status.value == "waiting"
    assert "RESOURCE_REALLOCATED" in event_types(c)


# 9 ---------------------------------------------------------------- waiting-time priority
def test_waiting_time_priority_formula_and_effect():
    c = fresh(waiting_coefficient=2.0, max_waiting_bonus=60.0)
    p = PriorityService(c.settings)
    assert p.waiting_bonus(0) == 0 and p.waiting_bonus(10) == 20 and p.waiting_bonus(1000) == 60  # capped
    run(c.agent.resource_unavailable("A02", "x"))
    run(c.agent.resource_unavailable("A03", "x"))
    from models.schemas import IncidentCreate
    run(c.agent.create_incident(IncidentCreate(description="Minor fender bender near Hebbal", severity=Severity.low)))
    _, plan = run(c.agent.create_incident(IncidentCreate(description=MED, severity=Severity.medium)))
    assert assigned_pairs(plan) == {("INC002", "A01")}                   # medium beats fresh low
    plan = run(c.agent.advance_time(40))                                 # low has waited 40 min
    assert c.store.incidents["INC001"].effective_priority == 80.0        # 20 + min(60, 2*40)
    assert assigned_pairs(plan) == {("INC001", "A01")}                   # starving incident now wins


# 10 --------------------------------------------------------------- resource failure
def test_resource_failure_reassigns():
    c = fresh()
    _, plan = add(c, ACC)
    broken = plan.assignments[0].resource_id
    plan2 = run(c.agent.resource_unavailable(broken, "engine fire"))
    assert broken not in {a.resource_id for a in plan2.assignments}
    assert len(plan2.assignments) == 1 and plan2.assignments[0].incident_id == "INC001"
    assert any(ch.kind == "lost" and ch.resource_id == broken for ch in plan2.changes)
    assert "RESOURCE_UNAVAILABLE" in event_types(c)


# 11 --------------------------------------------------------------- dynamic replanning (key scenario)
def test_dynamic_replanning_critical_plus_ambulance_failure():
    c = fresh()
    for t in (ACC, FIRE, MED):
        _, before = add(c, t)
    amb_before = {a.resource_id for a in before.assignments if a.resource_type.value == "ambulance"}
    assert amb_before == {"A01", "A02", "A03"}                           # 3 incidents + 3 ambulances
    before_pairs = assigned_pairs(before)

    col, _ = add(c, COLLAPSE)                                            # new critical incident
    after = run(c.agent.resource_unavailable("A01", "Mechanical breakdown"))   # ambulance failure

    assert assigned_pairs(after) != before_pairs                         # the plan changed
    assert "A01" not in {a.resource_id for a in after.assignments}
    got = {a.resource_type.value for a in after.assignments if a.incident_id == col.id}
    assert got == {"rescue_team", "ambulance", "medical_unit"}           # critical incident fully served
    assert after.unassigned_incidents and after.human_approval_required  # 4 incidents need 4 ambulances, 2 exist
    assert len(c.store.plan_history) >= 3
    assert "A01" in after.explanation and col.id in after.explanation
    for t in ("INCIDENT_CREATED", "RESOURCE_UNAVAILABLE", "PLAN_RECALCULATED", "HUMAN_APPROVAL_REQUIRED"):
        assert t in event_types(c)


def test_demo_scenario_endpoints_logic():
    c = fresh()
    run(c.agent.demo_t0())
    plan = run(c.agent.demo_t10())
    assert c.store.resources["A01"].status == ResourceStatus.unavailable
    assert plan.human_approval_required and plan.trigger.endswith("A01 became unavailable")


# 12 --------------------------------------------------------------- zero resources / boundary collapse
def test_zero_resources_boundary_collapse():
    c = fresh()
    for rid in ("A01", "A02", "A03"):
        run(c.agent.resource_unavailable(rid, "test"))
    n = len(c.store.resources)
    inc, plan = add(c, ACC)
    assert plan.assignments == [] and plan.human_approval_required
    assert plan.unassigned_incidents[0].no_supply_types == [ResourceType.ambulance]
    assert "No available ambulance for INC001" in c.store.pending_approvals()[0].reason
    assert "BOUNDARY_COLLAPSE" in event_types(c) and "HUMAN_APPROVAL_REQUIRED" in event_types(c)
    assert len(c.store.resources) == n                                   # never invents a resource
    assert inc.status.value == "waiting"


# 13 --------------------------------------------------------------- human approval
def test_human_approval_flow():
    c = fresh()
    for rid in ("A01", "A02", "A03"):
        run(c.agent.resource_unavailable(rid, "test"))
    add(c, ACC)
    ap = run(c.agent.decide(True, None, "call mutual aid"))
    assert ap.status.value == "approved"
    assert "APPROVAL_APPROVED" in event_types(c)
    assert not c.store.current_plan.human_approval_required
    assert raises(Conflict, lambda: run(c.agent.decide(True, ap.id))).code == "approval_conflict"
    assert raises(Conflict, lambda: run(c.agent.decide(False))).code == "no_pending_approval"
    plan = run(c.agent.recalculate())                                    # same shortage is not re-raised
    assert not plan.human_approval_required and "already reviewed" in plan.explanation
    # a different shortage raises a new request, which can be rejected
    add(c, MED)
    ap2 = run(c.agent.decide(False))
    assert ap2.status.value == "rejected" and "APPROVAL_REJECTED" in event_types(c)


def test_restoring_resource_supersedes_approval():
    c = fresh()
    for rid in ("A01", "A02", "A03"):
        run(c.agent.resource_unavailable(rid, "test"))
    add(c, ACC)
    assert c.store.pending_approvals()
    plan = run(c.agent.resource_available("A02"))
    assert not plan.human_approval_required and not plan.unassigned_incidents
    assert list(c.store.approvals.values())[0].status.value == "superseded"


# 14 --------------------------------------------------------------- explanations
def test_plan_explanations_use_only_known_facts():
    import re
    c = fresh()
    for t in (ACC, FIRE, MED, COLLAPSE):
        add(c, t)
    plan = run(c.agent.resource_unavailable("A02", "Mechanical breakdown"))
    assert all(a.reason for a in plan.assignments)
    known = set(c.store.incidents) | set(c.store.resources)
    mentioned = set(re.findall(r"\b(?:INC\d{3}|[AFRMS]\d{2})\b", plan.explanation))
    assert mentioned and mentioned <= known
    assert plan.explanation.startswith("Trigger: A02 became unavailable")


def test_route_service_example():
    c = fresh()
    r = RouteService(c.settings).estimate(12.9716, 77.5946, 12.9352, 77.6245)
    assert 4 < r.distance_km < 8 and r.eta_min > 1
