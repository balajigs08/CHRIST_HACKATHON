"""WebSocket Connection Manager — Phase 8.

Manages active WebSocket connections and provides a broadcast interface.
No authentication, no external service, no database.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set
from uuid import uuid4

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("websocket_manager")


# ---------------------------------------------------------------------------
# Message builder
# ---------------------------------------------------------------------------

def build_message(event: str, data: Any, meta: Optional[Dict] = None) -> str:
    """Build a JSON-serialisable real-time message in the standard envelope."""
    envelope: Dict[str, Any] = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    if meta:
        envelope["meta"] = meta
    return json.dumps(envelope, default=str)


# ---------------------------------------------------------------------------
# Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Thread-safe(ish) WebSocket connection manager for a single-process server."""

    def __init__(self) -> None:
        # Map of connection_id -> WebSocket
        self._connections: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    # -----------------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------------
    async def connect(self, websocket: WebSocket) -> str:
        """Accept the connection, register it, and return its connection_id."""
        await websocket.accept()
        conn_id = f"ws-{uuid4().hex[:8]}"
        async with self._lock:
            self._connections[conn_id] = websocket
        logger.info("WebSocket connected: %s  (total: %d)", conn_id, len(self._connections))

        # Welcome message
        await self._send_to(websocket, build_message(
            "system.update",
            {
                "message": "Connected to Crisis Command real-time feed",
                "connection_id": conn_id,
                "active_connections": len(self._connections),
            },
        ))
        return conn_id

    async def disconnect(self, conn_id: str) -> None:
        """Remove the connection from the registry (safe to call multiple times)."""
        async with self._lock:
            removed = self._connections.pop(conn_id, None)
        if removed:
            logger.info("WebSocket disconnected: %s  (remaining: %d)", conn_id, len(self._connections))

    # -----------------------------------------------------------------------
    # Send helpers
    # -----------------------------------------------------------------------
    @staticmethod
    async def _send_to(websocket: WebSocket, message: str) -> bool:
        """Send to one socket; return False if it failed (client gone)."""
        try:
            await websocket.send_text(message)
            return True
        except Exception:
            return False

    async def broadcast(self, message: str) -> int:
        """Broadcast a message to all connected clients.

        Stale connections are silently removed.
        Returns the number of successful sends.
        """
        if not self._connections:
            return 0

        async with self._lock:
            snapshot = dict(self._connections)

        dead: Set[str] = set()
        sent = 0
        for conn_id, ws in snapshot.items():
            ok = await self._send_to(ws, message)
            if ok:
                sent += 1
            else:
                dead.add(conn_id)

        # Prune dead connections
        if dead:
            async with self._lock:
                for cid in dead:
                    self._connections.pop(cid, None)
            logger.warning("Pruned %d dead connection(s)", len(dead))

        return sent

    async def send_to(self, conn_id: str, message: str) -> bool:
        """Send to a specific connection by ID."""
        ws = self._connections.get(conn_id)
        if ws is None:
            return False
        return await self._send_to(ws, message)

    # -----------------------------------------------------------------------
    # Properties
    # -----------------------------------------------------------------------
    @property
    def active_count(self) -> int:
        return len(self._connections)

    @property
    def connection_ids(self) -> list:
        return list(self._connections.keys())


# Module-level singleton used by all broadcast helpers
ws_manager = ConnectionManager()
