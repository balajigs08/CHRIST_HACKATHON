"""WebSocket API endpoint — Phase 8.

Provides:
    WS  /api/ws                 — main real-time feed (all events)
    GET /api/ws/status          — connection diagnostics (REST)
"""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.websocket_manager import build_message, ws_manager

logger = logging.getLogger("websocket_api")

router = APIRouter(tags=["WebSocket"])


# ---------------------------------------------------------------------------
# WS /api/ws
# ---------------------------------------------------------------------------
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    Main real-time WebSocket feed.

    Connect to this endpoint to receive live domain events:
      - incident.created / incident.updated
      - resource.created / resource.updated / resource.assigned / resource.unavailable
      - response_plan.created / response_plan.updated
      - alert.created
      - system.update

    Message format:
        {"event": "incident.created", "timestamp": "...", "data": {...}}

    Supports ping/pong keepalives:
        Client sends "ping" or {"type": "ping"} / {"action": "ping"}
        Server responds with {"event": "pong", "timestamp": "...", "data": {"message": "pong"}}
    """
    conn_id = await ws_manager.connect(websocket)
    logger.info("Client connected: %s", conn_id)

    try:
        while True:
            raw_text = await websocket.receive_text()
            text_strip = raw_text.strip()
            if text_strip.lower() == "ping":
                await websocket.send_text(build_message("pong", {"message": "pong"}))
            else:
                try:
                    payload = json.loads(text_strip)
                    if isinstance(payload, dict):
                        action = payload.get("action") or payload.get("type") or payload.get("event")
                        if action == "ping":
                            await websocket.send_text(build_message("pong", {"message": "pong"}))
                except Exception:
                    pass
    except WebSocketDisconnect:
        logger.info("Client disconnected: %s", conn_id)
    except Exception as exc:
        logger.warning("WebSocket error on %s: %s", conn_id, exc)
    finally:
        await ws_manager.disconnect(conn_id)


# ---------------------------------------------------------------------------
# GET /api/ws/status  (REST diagnostic)
# ---------------------------------------------------------------------------
@router.get(
    "/ws/status",
    summary="WebSocket connection status",
    description="Returns the number of active WebSocket connections and their IDs.",
    tags=["WebSocket"],
)
async def ws_status() -> dict:
    """Diagnostic endpoint: how many clients are connected."""
    return {
        "active_connections": ws_manager.active_count,
        "connection_ids": ws_manager.connection_ids,
        "status": "ok",
    }
