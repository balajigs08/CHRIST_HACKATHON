"""Simulated routing: haversine distance x road factor, ETA from average speed.
Swap this class for a real routing API later without touching the agents."""
from dataclasses import dataclass

from config import Settings
from utils.geo import haversine_km


@dataclass(frozen=True)
class RouteEstimate:
    distance_km: float
    eta_min: float


class RouteService:
    def __init__(self, settings: Settings):
        self.s = settings

    def estimate(self, lat1: float, lon1: float, lat2: float, lon2: float) -> RouteEstimate:
        km = haversine_km(lat1, lon1, lat2, lon2) * self.s.road_circuity_factor
        eta = km / self.s.average_speed_kmh * 60 + self.s.dispatch_delay_min
        return RouteEstimate(round(km, 2), round(eta, 1))
