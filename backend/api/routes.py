"""REST API. Thin layer: validation in, delegation to the agents, serialisation out."""
from fastapi import APIRouter, Query

from models.errors import Conflict
from models.schemas import (AdvanceRequest, ApprovalDecision, AssessRequest, IncidentCreate, IncidentUpdate,
                            ResourceAvailableRequest, ResourceCreate, ResourceUnavailableRequest, ResourceUpdate,
                            SimIncidentRequest)
from services.container import container

router = APIRouter(prefix="/api")
agent = container.agent
store = container.store


def dump(x):
    return x.model_dump(mode="json")


@router.get("/health")
async def health():
    return {"status": "ok", "system": "CRISIS COMMAND", "solver": "PuLP/CBC",
            "llm_configured": bool(container.settings.llm_api_key),
            "database": container.persistence.status(),
            "ws_clients": len(container.ws.connections)}


@router.get("/state")
async def state():
    return agent.snapshot()


# ---------------------------------------------------------------- incidents
@router.post("/incidents/assess")
async def assess(req: AssessRequest):
    import asyncio
    result = await asyncio.to_thread(container.assessor.assess, req.text, req.latitude, req.longitude)
    return dump(result)


@router.post("/incidents", status_code=201)
async def create_incident(body: IncidentCreate):
    inc, plan = await agent.create_incident(body)
    return {"incident": dump(inc), "plan": dump(plan)}


@router.get("/incidents")
async def list_incidents():
    return [dump(i) for i in sorted(store.incidents.values(), key=lambda i: i.id)]


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    return dump(store.get_incident(incident_id))


@router.put("/incidents/{incident_id}")
async def update_incident(incident_id: str, body: IncidentUpdate):
    inc, plan = await agent.update_incident(incident_id, body)
    return {"incident": dump(inc), "plan": dump(plan)}


# ---------------------------------------------------------------- resources
@router.post("/resources", status_code=201)
async def create_resource(body: ResourceCreate):
    return dump(await agent.create_resource(body))


@router.get("/resources")
async def list_resources():
    return [dump(r) for r in sorted(store.resources.values(), key=lambda r: r.id)]


@router.get("/resources/{resource_id}")
async def get_resource(resource_id: str):
    return dump(store.get_resource(resource_id))


@router.put("/resources/{resource_id}")
async def update_resource(resource_id: str, body: ResourceUpdate):
    res, plan = await agent.update_resource(resource_id, body)
    return {"resource": dump(res), "plan": dump(plan)}


# ---------------------------------------------------------------- plan
@router.post("/plan/optimize")
async def optimize():
    return dump(await agent.recalculate("operator requested optimization"))


@router.post("/plan/recalculate")
async def recalculate():
    return dump(await agent.recalculate("operator requested recalculation"))


@router.get("/plan/current")
async def current_plan():
    return dump(store.current_plan)


@router.get("/plan/history")
async def plan_history():
    return [dump(h) for h in store.plan_history]


# ---------------------------------------------------------------- events
@router.post("/events/incident", status_code=201)
async def event_incident(body: IncidentCreate):
    inc, plan = await agent.create_incident(body, source="event")
    return {"incident": dump(inc), "plan": dump(plan)}


@router.post("/events/resource-unavailable")
async def event_unavailable(body: ResourceUnavailableRequest):
    return dump(await agent.resource_unavailable(body.resource_id, body.reason))


@router.post("/events/resource-available")
async def event_available(body: ResourceAvailableRequest):
    return dump(await agent.resource_available(body.resource_id))


@router.get("/events")
async def list_events(limit: int = Query(200, ge=1, le=1000)):
    return [dump(e) for e in container.log.list(limit)]


# ---------------------------------------------------------------- approvals
@router.get("/approvals")
async def approvals():
    return [dump(a) for a in store.approvals.values()]


@router.post("/approval/approve")
async def approve(body: ApprovalDecision = ApprovalDecision()):
    return dump(await agent.decide(True, body.approval_id, body.note))


@router.post("/approval/reject")
async def reject(body: ApprovalDecision = ApprovalDecision()):
    return dump(await agent.decide(False, body.approval_id, body.note))


# ---------------------------------------------------------------- simulation
@router.post("/simulation/incident", status_code=201)
async def sim_incident(body: SimIncidentRequest):
    inc, plan = await agent.sim_incident(body.kind)
    return {"incident": dump(inc), "plan": dump(plan)}


@router.post("/simulation/break-ambulance")
async def break_ambulance():
    return dump(await agent.break_ambulance())


@router.post("/simulation/restore-ambulance")
async def restore_ambulance():
    return dump(await agent.restore_ambulance())


@router.post("/simulation/advance")
async def advance(body: AdvanceRequest = AdvanceRequest()):
    return dump(await agent.advance_time(body.minutes))


@router.post("/simulation/demo-t0")
async def demo_t0():
    return dump(await agent.demo_t0())


@router.post("/simulation/demo-t10")
async def demo_t10():
    return dump(await agent.demo_t10())


@router.post("/simulation/reset")
async def reset():
    await agent.reset()
    return {"status": "reset"}
