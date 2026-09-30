"""Route & ETA response schemas (Phase 5)."""
from typing import Optional
from pydantic import Field
from schemas.base import BaseSchema


class CoordinatePoint(BaseSchema):
    """A named geographic coordinate pair."""
    label: Optional[str] = Field(default=None, description="Human-readable location name")
    latitude: float = Field(..., description="WGS-84 latitude")
    longitude: float = Field(..., description="WGS-84 longitude")


class RouteEstimateResponse(BaseSchema):
    """Response for GET /api/routes/estimate."""
    origin: CoordinatePoint
    destination: CoordinatePoint
    straight_distance_km: float = Field(..., description="Straight-line Haversine distance (km)")
    distance_km: float = Field(..., description="Road-corrected distance (km)")
    estimated_time_minutes: float = Field(..., description="Estimated travel time including dispatch delay (minutes)")
    speed_kmph: float = Field(..., description="Average speed used for ETA calculation (km/h)")
    circuity_factor: float = Field(..., description="Road-circuity multiplier applied to straight-line distance")


class ResourceETAResponse(BaseSchema):
    """Response for GET /api/resources/{resource_id}/eta/{incident_id}."""
    resource_id: str
    incident_id: str
    resource_location: CoordinatePoint
    incident_location: CoordinatePoint
    straight_distance_km: float
    distance_km: float = Field(..., description="Road-corrected distance (km)")
    estimated_time_minutes: float = Field(..., description="Estimated travel time including dispatch delay (minutes)")
    speed_kmph: float
    circuity_factor: float
    resource_status: str = Field(..., description="Current operational status of the resource")
    incident_severity: str = Field(..., description="Severity level of the target incident")
