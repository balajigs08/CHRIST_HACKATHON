"""Phase 8 WebSocket & Real-Time Infrastructure Tests."""
import json
from fastapi.testclient import TestClient
from main import app
from services.websocket_manager import ws_manager, build_message


def test_ws_connection_and_welcome():
    client = TestClient(app)
    with client.websocket_connect("/api/ws") as ws:
        msg = ws.receive_json()
        assert msg["event"] == "system.update"
        assert "connection_id" in msg["data"]
        assert "active_connections" in msg["data"]


def test_ws_ping_pong():
    client = TestClient(app)
    with client.websocket_connect("/api/ws") as ws:
        _ = ws.receive_json()  # welcome
        # Text ping
        ws.send_text("ping")
        pong1 = ws.receive_json()
        assert pong1["event"] == "pong"
        assert pong1["data"]["message"] == "pong"

        # JSON ping
        ws.send_text(json.dumps({"action": "ping"}))
        pong2 = ws.receive_json()
        assert pong2["event"] == "pong"


def test_ws_multiple_clients_and_broadcast():
    client = TestClient(app)
    with client.websocket_connect("/api/ws") as ws1:
        _ = ws1.receive_json()
        with client.websocket_connect("/api/ws") as ws2:
            _ = ws2.receive_json()

            status = client.get("/api/ws/status").json()
            assert status["active_connections"] == 2

            # Trigger incident creation
            res = client.post("/api/incidents/", json={
                "incident_id": "inc-p8-test-multi",
                "type": "Road Hazard",
                "description": "Tree branch obstructing lanes",
                "location": "Sarjapur Road",
                "latitude": 12.9250,
                "longitude": 77.6800,
                "severity": "medium",
                "urgency": 5,
                "status": "reported",
                "required_resources": ["rescue_team"],
            })
            assert res.status_code == 201

            evt1 = ws1.receive_json()
            evt2 = ws2.receive_json()
            assert evt1["event"] == "incident.created"
            assert evt2["event"] == "incident.created"
            assert evt1["data"]["incident_id"] == "inc-p8-test-multi"
            assert evt2["data"]["incident_id"] == "inc-p8-test-multi"


def test_ws_mutation_events():
    client = TestClient(app)
    with client.websocket_connect("/api/ws") as ws:
        _ = ws.receive_json()  # welcome

        # 1. Incident updated
        res = client.put("/api/incidents/inc-p8-test-multi", json={"status": "in_progress"})
        assert res.status_code == 200
        evt = ws.receive_json()
        assert evt["event"] == "incident.updated"
        assert evt["data"]["incident_id"] == "inc-p8-test-multi"

        # 2. Resource created
        res = client.post("/api/resources/", json={
            "resource_id": "res-p8-test",
            "type": "ambulance",
            "location": "Sarjapur Depot",
            "latitude": 12.9240,
            "longitude": 77.6810,
            "status": "available",
            "availability": True,
        })
        assert res.status_code == 201
        evt = ws.receive_json()
        assert evt["event"] == "resource.created"
        assert evt["data"]["resource_id"] == "res-p8-test"

        # 3. Resource assigned
        res = client.put("/api/resources/res-p8-test", json={
            "assigned_incident_id": "inc-p8-test-multi",
            "status": "assigned",
            "availability": False,
        })
        assert res.status_code == 200
        evt = ws.receive_json()
        assert evt["event"] == "resource.assigned"
        assert evt["data"]["resource_id"] == "res-p8-test"

        # 4. Resource unavailable
        res = client.put("/api/resources/res-p8-test", json={
            "assigned_incident_id": None,
            "status": "unavailable",
            "availability": False,
        })
        assert res.status_code == 200
        # first event might be released/updated or unavailable
        evt = ws.receive_json()
        assert evt["event"] in ("resource.unavailable", "resource.updated")

        # 5. Response plan created
        res = client.post("/api/response-plans/", json={
            "plan_id": "plan-p8-test",
            "status": "draft",
            "incident_ids": ["inc-p8-test-multi"],
            "resource_assignments": [],
        })
        assert res.status_code == 201
        evt = ws.receive_json()
        assert evt["event"] == "response_plan.created"

        # 6. Response plan updated
        res = client.put("/api/response-plans/plan-p8-test", json={"status": "active"})
        assert res.status_code == 200
        evt = ws.receive_json()
        assert evt["event"] == "response_plan.updated"

        # 7. Alert created
        res = client.post("/api/events/", json={
            "event_id": "evt-p8-test",
            "event_type": "alert_triggered",
            "description": "Flash flood warning issued",
            "incident_id": "inc-p8-test-multi",
            "actor": "system",
        })
        assert res.status_code == 201
        evt = ws.receive_json()
        assert evt["event"] == "alert.created"
        assert evt["data"]["event_id"] == "evt-p8-test"
