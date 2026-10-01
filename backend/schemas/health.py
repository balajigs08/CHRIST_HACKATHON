"""Health check response schema."""
from typing import Any, Dict, Optional
from schemas.base import BaseSchema


class HealthResponse(BaseSchema):
    """Health check payload schema."""
    status: str = "ok"
    service: str = "crisis-command-backend"
    database: Optional[Dict[str, Any]] = None

