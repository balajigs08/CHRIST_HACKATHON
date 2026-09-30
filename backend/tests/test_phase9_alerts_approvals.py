"""Phase 9 Alerts & Human Approvals API acceptance tests."""
from fastapi.testclient import TestClient
from main import app


def test_alerts_crud_and_filters():
    client = TestClient(app)

    # 1. List seed alerts
    r = client.get("/api/alerts/")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 5

    # 2. Filter by severity
    r = client.get("/api/alerts/?severity=critical")
    assert r.status_code == 200
    for a in r.json():
        assert a["severity"] == "critical"

    # 3. Filter by status
    r = client.get("/api/alerts/?status=active")
    assert r.status_code == 200
    for a in r.json():
        assert a["status"] == "active"

    # 4. Filter by requires_human_attention
    r = client.get("/api/alerts/?requires_human_attention=true")
    assert r.status_code == 200
    for a in r.json():
        assert a["requires_human_attention"] is True

    # 5. Get by ID
    r = client.get("/api/alerts/alt-seed-001")
    assert r.status_code == 200
    assert r.json()["alert_id"] == "alt-seed-001"

    # 6. Not found
    r = client.get("/api/alerts/nonexistent")
    assert r.status_code == 404

    # 7. Create alert
    payload = {
        "alert_id": "alt-test-01",
        "title": "Substation Fire Risk",
        "description": "Transformer overheating detected",
        "severity": "critical",
        "status": "active",
        "requires_human_attention": True,
    }
    r = client.post("/api/alerts/", json=payload)
    assert r.status_code == 201
    assert r.json()["alert_id"] == "alt-test-01"

    # 8. Update & resolve alert
    r = client.put("/api/alerts/alt-test-01", json={"status": "resolved", "requires_human_attention": False})
    assert r.status_code == 200
    res = r.json()
    assert res["status"] == "resolved"
    assert res["resolved_at"] is not None


def test_approvals_crud_and_resolution():
    client = TestClient(app)

    # 1. List seed approvals
    r = client.get("/api/approvals/")
    assert r.status_code == 200
    assert len(r.json()) >= 4

    # 2. Filter by type
    r = client.get("/api/approvals/?type=resource_reallocation")
    assert r.status_code == 200
    for a in r.json():
        assert a["type"] == "resource_reallocation"

    # 3. Filter by status
    r = client.get("/api/approvals/?status=pending")
    assert r.status_code == 200
    for a in r.json():
        assert a["status"] == "pending"

    # 4. Get by ID
    r = client.get("/api/approvals/appr-seed-001")
    assert r.status_code == 200
    assert r.json()["request_id"] == "appr-seed-001"

    # 5. Create approval
    payload = {
        "request_id": "appr-test-01",
        "type": "emergency_dispatch",
        "description": "Authorize specialized boat rescue unit",
        "reason": "Rising floodwaters in residential area",
        "impact": "Mobilizes team 4",
        "status": "pending",
    }
    r = client.post("/api/approvals/", json=payload)
    assert r.status_code == 201
    assert r.json()["request_id"] == "appr-test-01"

    # 6. Resolve with approved
    r = client.put("/api/approvals/appr-test-01", json={
        "status": "approved",
        "resolved_by": "commander_roy",
        "note": "Immediate danger to life",
    })
    assert r.status_code == 200
    res = r.json()
    assert res["status"] == "approved"
    assert res["resolved_by"] == "commander_roy"
    assert res["resolved_at"] is not None

    # 7. Resolve with rejected
    r = client.put("/api/approvals/appr-seed-003", json={
        "status": "rejected",
        "resolved_by": "commander_roy",
        "note": "Safety protocol violation",
    })
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


def test_realtime_websocket_for_alerts_and_approvals():
    client = TestClient(app)
    with client.websocket_connect("/api/ws") as ws:
        _ = ws.receive_json()  # welcome

        # Alert create event
        r = client.post("/api/alerts/", json={
            "alert_id": "alt-test-ws",
            "title": "Hospital Generator Offline",
            "description": "Backup power failing",
            "severity": "critical",
            "requires_human_attention": True,
        })
        assert r.status_code == 201
        m1 = ws.receive_json()
        assert m1["event"] == "alert.created"

        # Approval create & approve events
        r = client.post("/api/approvals/", json={
            "request_id": "appr-test-ws",
            "type": "manual_override",
            "description": "Dispatch priority fuel truck",
            "reason": "Urgent hospital supply",
            "status": "pending",
        })
        assert r.status_code == 201
        m2 = ws.receive_json()
        assert m2["event"] == "approval.created"

        r = client.put("/api/approvals/appr-test-ws", json={"status": "approved"})
        assert r.status_code == 200
        m3 = ws.receive_json()
        assert m3["event"] == "approval.approved"
