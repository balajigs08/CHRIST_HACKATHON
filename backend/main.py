"""CRISIS COMMAND - FastAPI Backend Foundation (Phase 1).

Run locally:
    python -m uvicorn main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from api.routes import router as api_router
from config import settings
from models.errors import CrisisError

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("crisis-command")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for application startup and shutdown."""
    logger.info(f"Starting {settings.project_name} backend v{settings.version} in {settings.env} mode")
    yield
    logger.info(f"Shutting down {settings.project_name} backend")


# Initialize FastAPI application
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description=settings.description,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# -----------------------------------------------------------------------------
# CORS Middleware
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Error Handling
# -----------------------------------------------------------------------------
def format_error_response(status_code: int, code: str, message: str, details=None) -> JSONResponse:
    content = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details:
        content["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=content)


@app.exception_handler(CrisisError)
async def crisis_error_handler(_: Request, exc: CrisisError):
    """Handler for domain-specific errors."""
    return format_error_response(exc.status_code, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    """Handler for Pydantic schema validation failures."""
    details = [
        {"field": ".".join(str(loc) for loc in err["loc"] if loc != "body"), "message": err["msg"]}
        for err in exc.errors()
    ]
    return format_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="validation_error",
        message="Request validation failed",
        details=details,
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    """Handler for HTTP exceptions."""
    return format_error_response(
        status_code=exc.status_code,
        code="http_error",
        message=str(exc.detail),
    )


@app.exception_handler(Exception)
async def global_exception_handler(_: Request, exc: Exception):
    """Catch-all unhandled exception handler."""
    logger.exception("Unexpected server error: %s", exc)
    return format_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_server_error",
        message="An unexpected server error occurred.",
    )


# -----------------------------------------------------------------------------
# Routers and Endpoints
# -----------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root_redirect():
    """Redirect root path to interactive documentation."""
    return RedirectResponse(url="/docs")


# Include the API router with /api prefix
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
