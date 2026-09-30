"""Location & ETA Service — Phase 5.

Provides Haversine-based distance calculation, road-factor correction,
and ETA estimation using configurable average speed.

No external map API. No database. No AI.
"""
import math
from dataclasses import dataclass
from typing import Tuple

# ── Earth constants ────────────────────────────────────────────────────────────
_EARTH_RADIUS_KM = 6371.0088  # WGS-84 mean radius

# ── Defaults (overridden by config where needed) ───────────────────────────────
DEFAULT_SPEED_KMPH: float = 40.0   # urban average
DEFAULT_ROAD_CIRCUITY: float = 1.3  # straight-line → road multiplier
DEFAULT_DISPATCH_DELAY_MIN: float = 1.0


@dataclass(frozen=True)
class DistanceResult:
    """Raw Haversine straight-line distance (km)."""
    straight_km: float
    road_km: float  # after circuity factor


@dataclass(frozen=True)
class ETAResult:
    """Full route estimate returned by the service."""
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    distance_km: float          # road-corrected distance
    straight_distance_km: float
    estimated_time_minutes: float
    speed_kmph: float
    circuity_factor: float


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Pure Haversine formula. Returns straight-line distance in km."""
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def validate_coordinates(lat: float, lng: float, label: str = "coordinate") -> None:
    """Raise ValueError if lat/lng are outside valid WGS-84 ranges."""
    if not (-90.0 <= lat <= 90.0):
        raise ValueError(f"{label} latitude {lat} is out of range [-90, 90].")
    if not (-180.0 <= lng <= 180.0):
        raise ValueError(f"{label} longitude {lng} is out of range [-180, 180].")


class LocationService:
    """Stateless location, distance, and ETA service."""

    def __init__(
        self,
        default_speed_kmph: float = DEFAULT_SPEED_KMPH,
        road_circuity_factor: float = DEFAULT_ROAD_CIRCUITY,
        dispatch_delay_min: float = DEFAULT_DISPATCH_DELAY_MIN,
    ) -> None:
        self.default_speed_kmph = default_speed_kmph
        self.road_circuity_factor = road_circuity_factor
        self.dispatch_delay_min = dispatch_delay_min

    def distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> DistanceResult:
        """Calculate straight-line and road-corrected distance."""
        validate_coordinates(lat1, lon1, "origin")
        validate_coordinates(lat2, lon2, "destination")
        straight = haversine_km(lat1, lon1, lat2, lon2)
        road = straight * self.road_circuity_factor
        return DistanceResult(
            straight_km=round(straight, 3),
            road_km=round(road, 3),
        )

    def estimate(
        self,
        origin_lat: float,
        origin_lng: float,
        destination_lat: float,
        destination_lng: float,
        speed_kmph: float | None = None,
    ) -> ETAResult:
        """Compute road distance and ETA between two coordinate pairs."""
        speed = speed_kmph if speed_kmph is not None else self.default_speed_kmph
        if speed <= 0:
            raise ValueError(f"Speed must be positive, got {speed}.")

        dist = self.distance(origin_lat, origin_lng, destination_lat, destination_lng)
        travel_time = (dist.road_km / speed) * 60.0 + self.dispatch_delay_min

        return ETAResult(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            destination_lat=destination_lat,
            destination_lng=destination_lng,
            distance_km=round(dist.road_km, 3),
            straight_distance_km=round(dist.straight_km, 3),
            estimated_time_minutes=round(travel_time, 1),
            speed_kmph=round(speed, 1),
            circuity_factor=self.road_circuity_factor,
        )


# Module-level singleton — settings are applied from config at startup
def _make_service() -> LocationService:
    try:
        from config import settings
        return LocationService(
            default_speed_kmph=settings.average_speed_kmh,
            road_circuity_factor=settings.road_circuity_factor,
            dispatch_delay_min=settings.dispatch_delay_min,
        )
    except Exception:
        return LocationService()


location_service = _make_service()
