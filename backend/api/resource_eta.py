"""Resource → Incident ETA API — Phase 5.

Endpoint:
    GET /api/resources/{resource_id}/eta/{incident_id}

Returns the travel distance and estimated arrival time from a resource's
current position to an incident's location.

No external map API. No database. No AI.
"""
from fastapi import APIRouter, HTTPException, status

from schemas.route import CoordinatePoint, ResourceETAResponse
from services.incident_store import incident_store
from services.location_service import location_service
from services.resource_store import resource_store

router = APIRouter(prefix="/resources", tags=["Routes & ETA"])


@router.get(
    "/{resource_id}/eta/{incident_id}",
    response_model=ResourceETAResponse,
    summary="Get resource-to-incident ETA",
    description=(
        "Calculates the estimated travel time from a resource's current GPS position "
        "to an incident's reported location. Uses the same Haversine + road-circuity "
        "formula as /api/routes/estimate."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Resource or incident not found"},
        400: {"description": "Invalid location data on the resource or incident"},
    },
)
async def resource_eta(resource_id: str, incident_id: str) -> ResourceETAResponse:
    """Return distance and ETA from a specific resource to a specific incident."""
    # ── Look up resource ──────────────────────────────────────────────────────
    res = resource_store.get_by_id(resource_id)
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{resource_id}' not found.",
        )

    # ── Look up incident ──────────────────────────────────────────────────────
    inc = incident_store.get_by_id(incident_id)
    if inc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )

    # ── Compute ETA ───────────────────────────────────────────────────────────
    try:
        result = location_service.estimate(
            origin_lat=res.latitude,
            origin_lng=res.longitude,
            destination_lat=inc.latitude,
            destination_lng=inc.longitude,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return ResourceETAResponse(
        resource_id=resource_id,
        incident_id=incident_id,
        resource_location=CoordinatePoint(
            label=res.location,
            latitude=res.latitude,
            longitude=res.longitude,
        ),
        incident_location=CoordinatePoint(
            label=inc.location,
            latitude=inc.latitude,
            longitude=inc.longitude,
        ),
        straight_distance_km=result.straight_distance_km,
        distance_km=result.distance_km,
        estimated_time_minutes=result.estimated_time_minutes,
        speed_kmph=result.speed_kmph,
        circuity_factor=result.circuity_factor,
        resource_status=res.status.value,
        incident_severity=inc.severity.value,
    )
