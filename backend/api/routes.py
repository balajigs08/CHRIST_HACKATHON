"""FastAPI API routes — Crisis Command (Phases 1-9)."""
from fastapi import APIRouter

from api.alerts import router as alerts_router
from api.approvals import router as approvals_router
from api.events import router as events_router
from api.incidents import router as incidents_router
from api.resource_eta import router as resource_eta_router
from api.resources import router as resources_router
from api.response_plans import router as response_plans_router
from api.routes_eta import router as routes_eta_router
from api.websocket import router as ws_router
from config import settings
from schemas.health import HealthResponse
from schemas.root import RootResponse

router = APIRouter(prefix=settings.api_prefix, tags=["System"])


@router.get(
    "/",
    response_model=RootResponse,
    summary="Backend Root Information",
    description="Returns basic information about the Crisis Command backend.",
)
async def api_root() -> RootResponse:
    """Root endpoint for the /api prefix."""
    return RootResponse(
        message=f"{settings.project_name} API is running",
        service="crisis-command-backend",
        version=settings.version,
        docs_url="/docs",
        status="ok",
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health Check",
    description="Performs a lightweight health check of the backend service.",
)
async def health_check() -> HealthResponse:
    """Health check endpoint required by Phase 1 specification."""
    return HealthResponse(
        status="ok",
        service="crisis-command-backend",
    )


# ---------------------------------------------------------------------------
# Phase 3 — Incident Management
# ---------------------------------------------------------------------------
router.include_router(incidents_router)

# ---------------------------------------------------------------------------
# Phase 4 — Resource Management
# ---------------------------------------------------------------------------
router.include_router(resources_router)

# ---------------------------------------------------------------------------
# Phase 5 — Location / Route / ETA Services
# ---------------------------------------------------------------------------
router.include_router(resource_eta_router)
router.include_router(routes_eta_router)

# ---------------------------------------------------------------------------
# Phase 6 — Response Plans
# ---------------------------------------------------------------------------
router.include_router(response_plans_router)

# ---------------------------------------------------------------------------
# Phase 7 — Events & Audit
# ---------------------------------------------------------------------------
router.include_router(events_router)

# ---------------------------------------------------------------------------
# Phase 8 — WebSocket / Real-Time
# ---------------------------------------------------------------------------
router.include_router(ws_router)

# ---------------------------------------------------------------------------
# Phase 9 — Alerts & Human Approvals
# ---------------------------------------------------------------------------
router.include_router(alerts_router)
router.include_router(approvals_router)

