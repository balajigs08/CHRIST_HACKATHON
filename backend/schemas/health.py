"""Health check response schema."""
from schemas.base import BaseSchema


class HealthResponse(BaseSchema):
    """Health check payload schema."""
    status: str = "ok"
    service: str = "crisis-command-backend"
