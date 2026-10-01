"""Simulation, dynamic replanning, and operational control API routes."""
import asyncio
from fastapi import APIRouter, Query

from models.schemas import (
    AdvanceRequest,
    ApprovalDecision,
    AssessRequest,
    IncidentCreate,
    IncidentUpdate,
    ResourceAvailableRequest,
    ResourceCreate,
    ResourceUnavailableRequest,
    ResourceUpdate,
    SimIncidentRequest,
)
from services.container import container

router = APIRouter(tags=["Simulation & Operational Control"])
agent = container.agent
store = container.store


def dump(x):
    if hasattr(x, "model_dump"):
        return x.model_dump(mode="json")
    if isinstance(x, dict):
        return x
    return x


@router.get("/state")
async def state():
    """Return unified operational state snapshot."""
    return agent.snapshot()


# ---------------------------------------------------------------- assess
@router.post("/incidents/assess")
async def assess(req: AssessRequest):
    """Assess raw incident text using Incident Assessment Agent (rule-based + geocoding)."""
    result = await asyncio.to_thread(container.assessor.assess, req.text, req.latitude, req.longitude)
    return dump(result)


# ---------------------------------------------------------------- plan
@router.post("/plan/optimize")
async def optimize():
    """Trigger PuLP/CBC MILP resource optimization recalculation."""
    return dump(await agent.recalculate("operator requested optimization"))


@router.post("/plan/recalculate")
async def recalculate():
    """Trigger dynamic replanning across all active incidents and available resources."""
    return dump(await agent.recalculate("operator requested recalculation"))


@router.get("/plan/current")
async def current_plan():
    """Get the active response plan."""
    return dump(store.current_plan)


@router.get("/plan/history")
async def plan_history():
    """Get history of generated response plans."""
    return [dump(h) for h in store.plan_history]


# ---------------------------------------------------------------- approvals
@router.post("/approval/approve")
async def approve(body: ApprovalDecision = ApprovalDecision()):
    """Approve a pending operational action / plan."""
    return dump(await agent.decide(True, body.approval_id, body.note))


@router.post("/approval/reject")
async def reject(body: ApprovalDecision = ApprovalDecision()):
    """Reject a pending operational action / plan."""
    return dump(await agent.decide(False, body.approval_id, body.note))


# ---------------------------------------------------------------- simulation
@router.post("/simulation/incident", status_code=201)
async def sim_incident(body: SimIncidentRequest):
    """Simulate arrival of an incident of given kind."""
    inc, plan = await agent.sim_incident(body.kind)
    return {"incident": dump(inc), "plan": dump(plan)}


@router.post("/simulation/break-ambulance")
async def break_ambulance():
    """Simulate failure of an active ambulance triggering replanning."""
    return dump(await agent.break_ambulance())


@router.post("/simulation/restore-ambulance")
async def restore_ambulance():
    """Simulate restoration of the broken ambulance."""
    return dump(await agent.restore_ambulance())


@router.post("/simulation/advance")
async def advance(body: AdvanceRequest = AdvanceRequest()):
    """Advance simulation clock by given minutes."""
    return dump(await agent.advance_time(body.minutes))


@router.post("/simulation/demo-t0")
async def demo_t0():
    """Execute baseline T0 scenario demo."""
    return dump(await agent.demo_t0())


@router.post("/simulation/demo-t10")
async def demo_t10():
    """Execute disrupted T10 scenario demo."""
    return dump(await agent.demo_t10())


@router.post("/simulation/reset")
async def reset():
    """Reset simulation to initial state."""
    await agent.reset()
    return {"status": "reset"}
