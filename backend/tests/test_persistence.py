"""MongoDB persistence: restore after restart, id continuity, reset, outage tolerance, fail-fast startup.
Uses an in-memory fake Mongo (tests/fake_mongo.py) that rejects non-BSON values, so no server is needed."""
from datetime import datetime

import pytest
from conftest import add, assigned_pairs, fresh, run
from fake_mongo import FakeMongoClient

ACC = "Two-vehicle collision with injuries reported near Koramangala."
MED = "Medical emergency: elderly patient feeling weak and dizzy near Jayanagar."


def boot(client):
    """Start a 'server process': new container on the shared database, restored like main.py's lifespan does."""
    c = fresh(client=client)
    run(c.startup())
    return c


def collections(c, client):
    return client[c.settings.mongodb_db]


def test_new_database_is_seeded():
    client = FakeMongoClient()
    c = boot(client)
    db = collections(c, client)
    assert len(db["resources"].docs) == 8 and db["incidents"].docs == {}
    assert db["meta"].docs["state"]["current_plan_id"] == "PLN000"


def test_state_survives_restart():
    client = FakeMongoClient()
    a = boot(client)
    run(a.agent.demo_t0())
    run(a.agent.demo_t10())          # new critical incident + A01 breaks -> shortage -> pending approval
    assert a.store.pending_approvals()

    b = boot(client)                  # "restart"
    assert sorted(b.store.incidents) == sorted(a.store.incidents)
    for iid, x in a.store.incidents.items():
        y = b.store.incidents[iid]
        assert (y.status, y.severity, y.urgency, y.required_resources, y.assigned_resources, y.missing_resources,
                y.location_name) == (x.status, x.severity, x.urgency, x.required_resources, x.assigned_resources,
                                     x.missing_resources, x.location_name)
        assert y.created_at.tzinfo is not None
    assert {r.id: (r.status, r.current_assignment, r.capabilities) for r in b.store.resources.values()} == \
           {r.id: (r.status, r.current_assignment, r.capabilities) for r in a.store.resources.values()}
    assert b.store.current_plan.plan_id == a.store.current_plan.plan_id
    assert assigned_pairs(b.store.current_plan) == assigned_pairs(a.store.current_plan)
    assert {(x.incident_id, x.resource_id) for x in b.store.assignments} == assigned_pairs(a.store.current_plan)
    assert [(p.id, p.status) for p in b.store.approvals.values()] == [(p.id, p.status) for p in a.store.approvals.values()]
    assert [h.plan_id for h in b.store.plan_history] == [h.plan_id for h in a.store.plan_history]
    assert [e.id for e in b.log.events] == [e.id for e in a.log.events]
    assert b.agent.clock.offset == a.agent.clock.offset            # the T+10 simulation jump is remembered
    assert b.agent.snapshot()["summary"] == a.agent.snapshot()["summary"]


def test_ids_continue_after_restart():
    client = FakeMongoClient()
    a = boot(client)
    run(a.agent.demo_t0())            # INC001-003, PLN001
    before = len(a.log.events)
    b = boot(client)
    inc, plan = add(b, ACC)
    assert inc.id == "INC004" and plan.plan_id == "PLN002"
    ids = [e.id for e in b.log.events]
    assert len(ids) == len(set(ids)) and len(ids) > before          # no event id was reused


def test_operator_decision_survives_restart_and_is_not_asked_again():
    client = FakeMongoClient()
    a = boot(client)
    run(a.agent.demo_t0())
    run(a.agent.demo_t10())
    run(a.agent.decide(True, note="ok"))
    b = boot(client)
    assert b.store.acknowledged == a.store.acknowledged and b.store.acknowledged
    n = len(b.store.approvals)
    run(b.agent.recalculate())        # same unresolved shortage -> must not raise a second request
    assert len(b.store.approvals) == n and not b.store.pending_approvals()


def test_documents_are_plain_bson():
    client = FakeMongoClient()
    a = boot(client)
    run(a.agent.demo_t0())
    doc = collections(a, client)["incidents"].docs["INC001"]
    assert "id" not in doc and doc["_id"] == "INC001"
    assert type(doc["severity"]) is str and all(type(x) is str for x in doc["required_resources"])
    assert isinstance(doc["created_at"], datetime) and doc["created_at"].tzinfo is not None


def test_reset_wipes_the_database():
    client = FakeMongoClient()
    a = boot(client)
    run(a.agent.demo_t0())
    run(a.agent.reset())
    db = collections(a, client)
    assert db["incidents"].docs == {} and db["plan_history"].docs == {} and set(db["plans"].docs) == {"PLN000"}
    assert len(db["resources"].docs) == 8
    assert [d["event_type"] for d in db["events"].docs.values()] == ["SCENARIO_RESET"]
    b = boot(client)
    assert b.store.incidents == {} and add(b, ACC)[0].id == "INC001"


def test_mongo_outage_does_not_stop_dispatching_and_catches_up():
    client = FakeMongoClient()
    a = boot(client)
    client.fail_writes = True
    inc, plan = add(a, ACC)           # the operation still succeeds in memory
    assert inc.id == "INC001" and plan.assignments
    status = a.persistence.status()
    assert status["status"] == "degraded" and "ConnectionError" in status["last_error"]
    assert collections(a, client)["incidents"].docs == {}

    client.fail_writes = False
    add(a, MED)                       # next operation writes everything that was missed
    assert a.persistence.status()["status"] == "ok"
    b = boot(client)
    assert sorted(b.store.incidents) == ["INC001", "INC002"]
    assert [e.id for e in b.log.events] == [e.id for e in a.log.events]


def test_startup_fails_fast_and_never_overwrites_existing_data():
    client = FakeMongoClient()
    a = boot(client)
    run(a.agent.demo_t0())
    stored = {n: dict(collections(a, client)[n].docs) for n in ("incidents", "resources", "events")}
    client.fail_ping = True
    with pytest.raises(ConnectionError):
        run(fresh(client=client).startup())
    assert {n: dict(collections(a, client)[n].docs) for n in stored} == stored
