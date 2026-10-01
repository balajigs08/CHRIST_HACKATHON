"""FastAPI API routes — Crisis Command (Phases 1-9)."""
from fastapi import APIRouter

from api.alerts import router as alerts_router
from api.approvals import router as approvals_router
from api.auth import router as auth_router
from api.events import router as events_router
from api.incidents import router as incidents_router
from api.resource_eta import router as resource_eta_router
from api.resources import router as resources_router
from api.response_plans import router as response_plans_router
from api.routes_eta import router as routes_eta_router
from api.simulation import router as simulation_router
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


_persistence = None


def get_persistence():
    global _persistence
    if _persistence is None:
        try:
            from db.mongo import MongoPersistence, create_client
            client = create_client(settings)
            _persistence = MongoPersistence(client, settings.mongodb_db)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            raise RuntimeError(f"get_persistence failed: {exc}") from exc
    return _persistence


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health Check",
    description="Performs a health check of the backend service and database connection.",
)
async def health_check() -> HealthResponse:
    """Health check endpoint returning service and database status."""
    db_status = None
    try:
        p = get_persistence()
        db_status = p.status()
    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        db_status = {"backend": "mongodb", "status": "error", "last_error": str(exc), "trace": tb}

    return HealthResponse(
        status="ok",
        service="crisis-command-backend",
        database=db_status,
    )






# ---------------------------------------------------------------------------
# Authentication & OTP Verification
# ---------------------------------------------------------------------------
router.include_router(auth_router)

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

# ---------------------------------------------------------------------------
# Operational Control & Simulation
# ---------------------------------------------------------------------------
router.include_router(simulation_router)

