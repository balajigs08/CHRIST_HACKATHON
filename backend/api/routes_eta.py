"""Route estimation API — Phase 5.

Endpoints:
    GET /api/routes/estimate  — distance + ETA between two coordinate pairs

No external map API. No database. No AI.
"""
from fastapi import APIRouter, HTTPException, Query, status

from schemas.route import CoordinatePoint, RouteEstimateResponse
from services.location_service import location_service

router = APIRouter(prefix="/routes", tags=["Routes & ETA"])


@router.get(
    "/estimate",
    response_model=RouteEstimateResponse,
    summary="Estimate route distance and travel time",
    description=(
        "Calculates straight-line (Haversine) and road-corrected distance between two "
        "coordinate pairs, then derives an ETA using a configurable average speed. "
        "No external map API is used — all calculations are local."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Invalid parameter (e.g. non-positive speed)"},
        422: {"description": "Coordinates out of valid WGS-84 range"},
    },
)
async def estimate_route(
    origin_lat: float = Query(..., ge=-90.0, le=90.0, description="Origin latitude (-90 to 90)"),
    origin_lng: float = Query(..., ge=-180.0, le=180.0, description="Origin longitude (-180 to 180)"),
    destination_lat: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude (-90 to 90)"),
    destination_lng: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude (-180 to 180)"),
    speed_kmph: float = Query(
        default=None,
        gt=0,
        le=300,
        description="Override average travel speed in km/h (default: server configured value)",
    ),
) -> RouteEstimateResponse:
    """Return distance and ETA for arbitrary coordinate pairs."""
    try:
        result = location_service.estimate(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            destination_lat=destination_lat,
            destination_lng=destination_lng,
            speed_kmph=speed_kmph,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return RouteEstimateResponse(
        origin=CoordinatePoint(latitude=origin_lat, longitude=origin_lng),
        destination=CoordinatePoint(latitude=destination_lat, longitude=destination_lng),
        straight_distance_km=result.straight_distance_km,
        distance_km=result.distance_km,
        estimated_time_minutes=result.estimated_time_minutes,
        speed_kmph=result.speed_kmph,
        circuity_factor=result.circuity_factor,
    )
