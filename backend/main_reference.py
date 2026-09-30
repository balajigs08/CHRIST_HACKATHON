"""CRISIS COMMAND backend entrypoint:  uvicorn main:app --reload --port 8000"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import router
from models.errors import CrisisError
from services.container import container

log = logging.getLogger("crisis-command")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await container.startup()   # connect to MongoDB and restore the persisted state
    try:
        yield
    finally:
        await container.shutdown()


app = FastAPI(title="CRISIS COMMAND", version="1.0.0", lifespan=lifespan,
              description="Multi-Agent Emergency Response & Resource Coordination")
app.add_middleware(CORSMiddleware, allow_origins=list(container.settings.cors_origins),
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


def _err(status: int, code: str, message: str, details=None):
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


@app.exception_handler(CrisisError)
async def crisis_error_handler(_: Request, exc: CrisisError):
    return _err(exc.status_code, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
    first = details[0] if details else {"field": "", "message": "invalid"}
    return _err(422, "validation_error", f"Invalid request: {first['field']} - {first['message']}", details)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return _err(500, "internal_error", "Unexpected server error; see backend log.")


@app.websocket("/ws/dashboard")
async def dashboard_ws(ws: WebSocket):
    mgr = container.ws
    await mgr.connect(ws)
    try:
        await ws.send_json({"type": "state_snapshot", "snapshot": container.agent.snapshot()})
        while True:
            if (await ws.receive_text()) == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("WebSocket error")
    finally:
        mgr.disconnect(ws)
