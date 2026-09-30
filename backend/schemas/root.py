"""Root endpoint response schema."""
from typing import Optional
from schemas.base import BaseSchema


class RootResponse(BaseSchema):
    """Basic backend service information schema."""
    message: str = "Crisis Command API is running"
    service: str = "crisis-command-backend"
    version: str = "1.0.0"
    docs_url: str = "/docs"
    status: str = "ok"
