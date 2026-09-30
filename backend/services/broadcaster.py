"""Real-time broadcast helpers — Phase 8.

Fire-and-forget async broadcasts called by domain stores on mutations.
All functions are safe to call from sync code via asyncio.create_task()
or the _fire() helper below.
"""
import asyncio
import logging
from typing import Any, Dict

from services.websocket_manager import build_message, ws_manager

logger = logging.getLogger("broadcaster")


def _fire(event: str, data: Any, meta: Dict | None = None) -> None:
    """
    Schedule a broadcast on the running event loop without blocking.

    Works whether called from an async context (creates a task) or a sync
    context at startup (schedules via loop if one is running).
    """
    msg = build_message(event, data, meta)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(ws_manager.broadcast(msg))
    except RuntimeError:
        # No running loop (e.g. during import / unit tests) — silently skip
        pass


# ---------------------------------------------------------------------------
# Domain-specific broadcast helpers
# ---------------------------------------------------------------------------

def broadcast_incident_created(incident: Any) -> None:
    data = incident.model_dump() if hasattr(incident, "model_dump") else dict(incident)
    _fire("incident.created", data)


def broadcast_incident_updated(incident: Any, changed_fields: list | None = None) -> None:
    data = incident.model_dump() if hasattr(incident, "model_dump") else dict(incident)
    _fire("incident.updated", data, meta={"changed_fields": changed_fields or []})


def broadcast_resource_created(resource: Any) -> None:
    data = resource.model_dump() if hasattr(resource, "model_dump") else dict(resource)
    _fire("resource.created", data)


def broadcast_resource_updated(resource: Any, changed_fields: list | None = None) -> None:
    data = resource.model_dump() if hasattr(resource, "model_dump") else dict(resource)
    _fire("resource.updated", data, meta={"changed_fields": changed_fields or []})


def broadcast_resource_assigned(resource: Any) -> None:
    data = resource.model_dump() if hasattr(resource, "model_dump") else dict(resource)
    _fire("resource.assigned", data)


def broadcast_resource_unavailable(resource: Any) -> None:
    data = resource.model_dump() if hasattr(resource, "model_dump") else dict(resource)
    _fire("resource.unavailable", data)


def broadcast_plan_created(plan: Any) -> None:
    data = plan.model_dump() if hasattr(plan, "model_dump") else dict(plan)
    _fire("response_plan.created", data)


def broadcast_plan_updated(plan: Any, changed_fields: list | None = None) -> None:
    data = plan.model_dump() if hasattr(plan, "model_dump") else dict(plan)
    _fire("response_plan.updated", data, meta={"changed_fields": changed_fields or []})


def broadcast_alert_created(alert: Any) -> None:
    data = alert.model_dump() if hasattr(alert, "model_dump") else dict(alert)
    _fire("alert.created", data)


def broadcast_alert_updated(alert: Any, changed_fields: list | None = None) -> None:
    data = alert.model_dump() if hasattr(alert, "model_dump") else dict(alert)
    _fire("alert.updated", data, meta={"changed_fields": changed_fields or []})


def broadcast_approval_created(approval: Any) -> None:
    data = approval.model_dump() if hasattr(approval, "model_dump") else dict(approval)
    _fire("approval.created", data)


def broadcast_approval_updated(approval: Any, changed_fields: list | None = None) -> None:
    data = approval.model_dump() if hasattr(approval, "model_dump") else dict(approval)
    _fire("approval.updated", data, meta={"changed_fields": changed_fields or []})


def broadcast_approval_resolved(approval: Any, decision: str) -> None:
    data = approval.model_dump() if hasattr(approval, "model_dump") else dict(approval)
    evt_name = f"approval.{decision.lower()}"
    _fire(evt_name, data, meta={"decision": decision})


def broadcast_event_created(event: Any) -> None:
    data = event.model_dump() if hasattr(event, "model_dump") else dict(event)
    _fire("alert.created", data)


def broadcast_system_update(message: str, payload: Dict | None = None) -> None:
    _fire("system.update", {"message": message, **(payload or {})})
