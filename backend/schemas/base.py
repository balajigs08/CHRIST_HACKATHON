"""Base Pydantic v2 configuration and foundation schemas."""
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict


def utc_now() -> datetime:
    """Helper returning timezone-aware current UTC time."""
    return datetime.now(timezone.utc)


class BaseSchema(BaseModel):
    """Base schema configured for Pydantic v2."""
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        arbitrary_types_allowed=True,
        str_strip_whitespace=True,
    )

