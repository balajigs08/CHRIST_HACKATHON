"""Phase 10 Final Backend & Integration Acceptance Tests."""
import json
from fastapi.testclient import TestClient
from main import app


def test_health_and_docs():
    client = TestClient(app)
    # Health check
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["service"] == "crisis-command-backend"

    # Root info
    r = client.get("/api/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    # Interactive docs
    r = client.get("/docs")
    assert r.status_code == 200


def test_cors_headers():
    client = TestClient(app)
    headers = {"Origin": "http://localhost:5173"}
    r = client.get("/api/health", headers=headers)
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_all_domain_endpoints_list():
    client = TestClient(app)
    endpoints = [
        ("/api/incidents/", 200),
        ("/api/resources/", 200),
        ("/api/routes/estimate?origin_lat=12.97&origin_lng=77.59&destination_lat=12.96&destination_lng=77.75", 200),
        ("/api/resources/RES-AMB-01/eta/inc-seed-001", 200),
        ("/api/response-plans/", 200),
        ("/api/events/", 200),
        ("/api/alerts/", 200),
        ("/api/approvals/", 200),
        ("/api/ws/status", 200),
    ]
    for url, expected in endpoints:
        res = client.get(url)
        assert res.status_code == expected, f"{url} returned {res.status_code}"


def test_e2e_crud_and_ws_notifications():
    client = TestClient(app)

    with client.websocket_connect("/api/ws") as ws:
        # Welcome
        m0 = ws.receive_json()
        assert m0["event"] == "system.update"

        # 1. Incident: Create -> Read -> Update -> Delete
        inc_data = {
            "incident_id": "inc-final-test",
            "type": "Industrial Fire",
            "description": "Chemical storage fire",
            "location": "Bommasandra",
            "latitude": 12.8100,
            "longitude": 77.6800,
            "severity": "critical",
            "urgency": 9,
            "status": "reported",
            "required_resources": ["fire_team"],
        }
        res = client.post("/api/incidents/", json=inc_data)
        assert res.status_code == 201
        m1 = ws.receive_json()
        assert m1["event"] == "incident.created"
        assert m1["data"]["incident_id"] == "inc-final-test"

        # Read
        res = client.get("/api/incidents/inc-final-test")
        assert res.status_code == 200

        # Update
        res = client.put("/api/incidents/inc-final-test", json={"status": "in_progress"})
        assert res.status_code == 200
        m2 = ws.receive_json()
        assert m2["event"] == "incident.updated"

        # Delete
        res = client.delete("/api/incidents/inc-final-test")
        assert res.status_code == 200
        assert client.get("/api/incidents/inc-final-test").status_code == 404

        # 2. Resource: Create -> Assign -> Delete
        res_data = {
            "resource_id": "res-final-test",
            "type": "rescue_team",
            "location": "Bommasandra Station",
            "latitude": 12.8120,
            "longitude": 77.6810,
            "status": "available",
            "availability": True,
        }
        res = client.post("/api/resources/", json=res_data)
        assert res.status_code == 201
        m3 = ws.receive_json()
        assert m3["event"] == "resource.created"

        # Assign
        res = client.put("/api/resources/res-final-test", json={
            "assigned_incident_id": "inc-seed-001",
            "status": "assigned",
            "availability": False,
        })
        assert res.status_code == 200
        m4 = ws.receive_json()
        assert m4["event"] == "resource.assigned"

        res = client.delete("/api/resources/res-final-test")
        assert res.status_code == 200

        # 3. Response Plan: Create -> Update
        plan_data = {
            "plan_id": "plan-final-test",
            "status": "pending",
            "incident_ids": ["inc-seed-001"],
            "resource_assignments": [],
        }
        res = client.post("/api/response-plans/", json=plan_data)
        assert res.status_code == 201
        m5 = ws.receive_json()
        assert m5["event"] == "response_plan.created"

        res = client.put("/api/response-plans/plan-final-test", json={"status": "active"})
        assert res.status_code == 200
        m6 = ws.receive_json()
        assert m6["event"] == "response_plan.updated"

        # 4. Alert: Create -> Resolve
        alert_data = {
            "alert_id": "alt-final-test",
            "title": "Industrial Gas Surge",
            "description": "High pressure detected",
            "severity": "critical",
            "requires_human_attention": True,
        }
        res = client.post("/api/alerts/", json=alert_data)
        assert res.status_code == 201
        m7 = ws.receive_json()
        assert m7["event"] == "alert.created"

        res = client.put("/api/alerts/alt-final-test", json={"status": "resolved"})
        assert res.status_code == 200
        m8 = ws.receive_json()
        assert m8["event"] == "alert.updated"
        assert res.json()["resolved_at"] is not None

        # 5. Approval: Create -> Approve
        appr_data = {
            "request_id": "appr-final-test",
            "type": "resource_reallocation",
            "description": "Reallocate unit to emergency",
            "reason": "Immediate life safety",
            "status": "pending",
        }
        res = client.post("/api/approvals/", json=appr_data)
        assert res.status_code == 201
        m9 = ws.receive_json()
        assert m9["event"] == "approval.created"

        res = client.put("/api/approvals/appr-final-test", json={
            "status": "approved",
            "resolved_by": "commander",
        })
        assert res.status_code == 200
        m10 = ws.receive_json()
        assert m10["event"] == "approval.approved"
        m11 = ws.receive_json()
        assert m11["event"] == "approval.updated"

        # Keepalive ping
        ws.send_text("ping")
        pong = ws.receive_json()
        assert pong["event"] == "pong"


def test_validation_and_not_found_handling():
    client = TestClient(app)

    # 404s
    assert client.get("/api/incidents/nonexistent").status_code == 404
    assert client.get("/api/resources/nonexistent").status_code == 404
    assert client.get("/api/alerts/nonexistent").status_code == 404
    assert client.get("/api/approvals/nonexistent").status_code == 404

    # 422s (validation)
    assert client.post("/api/incidents/", json={}).status_code == 422
    assert client.post("/api/resources/", json={}).status_code == 422
    assert client.post("/api/alerts/", json={}).status_code == 422
    assert client.post("/api/approvals/", json={}).status_code == 422
