"""HTTP + WebSocket integration tests (need fastapi/httpx installed)."""
import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:  # one shared event loop => WebSocket broadcasts reach the test client
        c.post("/api/simulation/reset")
        yield c


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["database"]["backend"] == "mongodb" and body["database"]["status"] == "ok"


def test_assess_and_create_incident(client):
    r = client.post("/api/incidents/assess", json={"text": "Major building fire near Whitefield. Several people are trapped inside."})
    assert r.status_code == 200 and r.json()["severity"] == "critical"
    r = client.post("/api/incidents", json={"description": "Two-vehicle collision with injuries near Koramangala"})
    assert r.status_code == 201
    body = r.json()
    assert body["incident"]["id"] == "INC001" and body["plan"]["assignments"]
    assert client.get("/api/incidents/INC001").status_code == 200
    assert len(client.get("/api/incidents").json()) == 1


def test_validation_and_not_found(client):
    r = client.post("/api/incidents", json={"description": "fire near Hebbal", "severity": "apocalyptic"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
    assert client.get("/api/incidents/NOPE").json()["error"]["code"] == "incident_not_found"
    assert client.post("/api/events/resource-unavailable", json={"resource_id": "ZZ9"}).status_code == 404
    assert client.post("/api/resources", json={"type": "helicopter", "latitude": 1, "longitude": 1}).status_code == 422


def test_full_demo_flow_with_websocket(client):
    client.post("/api/simulation/demo-t0")
    plan0 = client.get("/api/plan/current").json()
    with client.websocket_connect("/ws/dashboard") as ws:
        assert ws.receive_json()["type"] == "state_snapshot"
        client.post("/api/simulation/demo-t10")
        types = []
        while True:
            msg = ws.receive_json()
            types.append(msg["type"])
            if msg["type"] == "state_snapshot":
                snap = msg["snapshot"]
                break
    assert "resource_unavailable" in types and "human_approval_required" in types
    assert snap["plan"]["plan_id"] != plan0["plan_id"] and snap["approvals"][0]["status"] == "pending"
    r = client.post("/api/approval/approve", json={"note": "ok"})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert client.post("/api/approval/approve", json={}).status_code == 409
    assert any(e["event_type"] == "APPROVAL_APPROVED" for e in client.get("/api/events").json())


def test_resource_event_endpoints(client):
    client.post("/api/incidents", json={"description": "Medical emergency near Jayanagar"})
    assert client.post("/api/events/resource-unavailable", json={"resource_id": "A03", "reason": "x"}).status_code == 200
    assert client.post("/api/events/resource-available", json={"resource_id": "A03"}).status_code == 200
    assert client.post("/api/plan/recalculate").status_code == 200
    assert client.put("/api/resources/A01", json={"status": "assigned"}).status_code == 422
