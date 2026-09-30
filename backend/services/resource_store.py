"""In-memory resource store (Phase 4).

Provides CRUD operations, filtering, and assignment-rule enforcement.
No database, no AI, no optimization, no WebSocket.
"""
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status as http_status

from schemas.base import utc_now
from schemas.enums import EventType, ResourceStatus, ResourceType
from schemas.resource import ResourceCreate, ResourceResponse, ResourceUpdate
from services.event_service import event_service
from services.broadcaster import (
    broadcast_resource_created,
    broadcast_resource_updated,
    broadcast_resource_assigned,
    broadcast_resource_unavailable,
)

# ---------------------------------------------------------------------------
# Seed data — realistic Bengaluru emergency resources
# ---------------------------------------------------------------------------
_SEED_RESOURCES = [
    # Ambulances
    ("RES-AMB-01", ResourceType.AMBULANCE,   "Cubbon Park Station",           12.9716, 77.5946, ResourceStatus.AVAILABLE,  True,  None),
    ("RES-AMB-02", ResourceType.AMBULANCE,   "Indiranagar Depot",             12.9784, 77.6408, ResourceStatus.AVAILABLE,  True,  None),
    ("RES-AMB-03", ResourceType.AMBULANCE,   "Jayanagar 4th Block Station",   12.9250, 77.5938, ResourceStatus.ASSIGNED,   False, "inc-seed-002"),
    # Fire Units
    ("RES-FIRE-01", ResourceType.FIRE_TEAM,  "Whitefield Fire Station",       12.9698, 77.7500, ResourceStatus.DISPATCHED, False, "inc-seed-001"),
    ("RES-FIRE-02", ResourceType.FIRE_TEAM,  "Hebbal Fire Station",           13.0358, 77.5970, ResourceStatus.AVAILABLE,  True,  None),
    # Police Units
    ("RES-POL-01",  ResourceType.POLICE,     "Koramangala Police Station",    12.9352, 77.6245, ResourceStatus.ASSIGNED,   False, "inc-seed-002"),
    ("RES-POL-02",  ResourceType.POLICE,     "MG Road Police Station",        12.9756, 77.6066, ResourceStatus.AVAILABLE,  True,  None),
    # Rescue Teams
    ("RES-RESC-01", ResourceType.RESCUE_TEAM, "Domlur Search & Rescue Base",  12.9609, 77.6387, ResourceStatus.AVAILABLE,  True,  None),
    ("RES-RESC-02", ResourceType.RESCUE_TEAM, "Electronic City Rescue Depot", 12.8399, 77.6770, ResourceStatus.DISPATCHED, False, "inc-seed-001"),
    # Medical Teams
    ("RES-MED-01",  ResourceType.MEDICAL_UNIT, "Shivajinagar Medical Unit",   12.9857, 77.6057, ResourceStatus.AVAILABLE,  True,  None),
    ("RES-MED-02",  ResourceType.MEDICAL_UNIT, "Rajajinagar Medical Unit",    12.9902, 77.5558, ResourceStatus.MAINTENANCE,False, None),
    # Shelter
    ("RES-SHLT-01", ResourceType.SHELTER,    "Malleshwaram Community Centre", 13.0035, 77.5647, ResourceStatus.AVAILABLE,  True,  None),
]


class ResourceStore:
    """In-memory store for emergency resources."""

    def __init__(self) -> None:
        self._store: Dict[str, ResourceResponse] = {}
        self._seed()

    def _seed(self) -> None:
        now = utc_now()
        for (rid, rtype, loc, lat, lon, rstatus, avail, assigned) in _SEED_RESOURCES:
            res = ResourceResponse(
                id=rid,
                type=rtype,
                location=loc,
                latitude=lat,
                longitude=lon,
                status=rstatus,
                availability=avail,
                assigned_incident_id=assigned,
                updated_at=now,
            )
            self._store[rid] = res

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------
    def get_all(
        self,
        resource_type: Optional[str] = None,
        status: Optional[str] = None,
        availability: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[ResourceResponse]:
        resources = list(self._store.values())

        if resource_type:
            rt = resource_type.lower().strip()
            resources = [r for r in resources if r.type.value == rt]

        if status:
            st = status.lower().strip()
            resources = [r for r in resources if r.status.value == st]

        if availability is not None:
            resources = [r for r in resources if r.availability == availability]

        if search:
            q = search.lower().strip()
            resources = [
                r for r in resources
                if q in r.location.lower() or q in r.type.value.lower() or q in r.resource_id.lower()
            ]

        resources.sort(key=lambda r: r.resource_id)
        return resources

    def get_by_id(self, resource_id: str) -> Optional[ResourceResponse]:
        return self._store.get(resource_id)

    # -----------------------------------------------------------------------
    # Mutations
    # -----------------------------------------------------------------------
    def create(self, payload: ResourceCreate, actor: str = "operator") -> ResourceResponse:
        res_id = payload.resource_id if payload.resource_id else f"res-{uuid4().hex[:8]}"
        if res_id in self._store:
            res_id = f"res-{uuid4().hex[:8]}"

        res = ResourceResponse(
            id=res_id,
            type=payload.type,
            location=payload.location,
            latitude=payload.latitude,
            longitude=payload.longitude,
            status=payload.status,
            availability=payload.availability,
            assigned_incident_id=payload.assigned_incident_id,
            updated_at=utc_now(),
        )
        self._store[res_id] = res

        event_service.record(
            event_type=EventType.RESOURCE_UPDATED,
            description=f"New resource registered: {res.type.value.upper()} at {res.location} [{res_id}]",
            resource_id=res_id,
            actor=actor,
            payload={"type": res.type.value, "status": res.status.value, "location": res.location},
        )
        broadcast_resource_created(res)
        return res

    def update(
        self, resource_id: str, payload: ResourceUpdate, actor: str = "operator"
    ) -> ResourceResponse:
        """
        Partially update a resource, enforcing assignment business rules.

        Rules enforced here (not in the schema layer):
          1. A resource with status=unavailable or maintenance cannot be assigned.
          2. A resource already assigned to an incident cannot be re-assigned
             to a different incident without first releasing it.
        """
        res = self._store.get(resource_id)
        if res is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Resource '{resource_id}' not found.",
            )

        updates = payload.model_dump(exclude_unset=True)

        # --- Rule 1: cannot assign an unavailable/maintenance resource --------
        new_status = updates.get("status", res.status)
        new_assigned = updates.get("assigned_incident_id", res.assigned_incident_id)

        if new_assigned is not None:
            blocked_statuses = {ResourceStatus.UNAVAILABLE, ResourceStatus.MAINTENANCE}
            if new_status in blocked_statuses:
                raise HTTPException(
                    status_code=http_status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot assign resource '{resource_id}' to an incident: "
                        f"resource status is '{new_status.value}'."
                    ),
                )

        # --- Rule 2: single active assignment --------------------------------
        if (
            new_assigned is not None
            and res.assigned_incident_id is not None
            and new_assigned != res.assigned_incident_id
        ):
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=(
                    f"Resource '{resource_id}' is already assigned to incident "
                    f"'{res.assigned_incident_id}'. Release it first before reassigning."
                ),
            )

        # Apply updates
        data = res.model_dump()
        data.update(updates)
        data["updated_at"] = utc_now()
        updated = ResourceResponse(**data)
        self._store[resource_id] = updated

        changed = list(updates.keys())
        # Determine the most meaningful event type
        if "assigned_incident_id" in changed and updated.assigned_incident_id:
            evt_type = EventType.RESOURCE_ASSIGNED
            broadcast_resource_assigned(updated)
        elif "assigned_incident_id" in changed and not updated.assigned_incident_id:
            evt_type = EventType.RESOURCE_RELEASED
            broadcast_resource_updated(updated, changed)
        elif "status" in changed and updated.status in (ResourceStatus.UNAVAILABLE, ResourceStatus.MAINTENANCE):
            evt_type = EventType.RESOURCE_UNAVAILABLE
            broadcast_resource_unavailable(updated)
        elif "status" in changed and updated.status == ResourceStatus.AVAILABLE:
            evt_type = EventType.RESOURCE_AVAILABLE
            broadcast_resource_updated(updated, changed)
        else:
            evt_type = EventType.RESOURCE_UPDATED
            broadcast_resource_updated(updated, changed)

        event_service.record(
            event_type=evt_type,
            description=(
                f"Resource {resource_id} ({res.type.value}) updated. "
                f"Changed: {', '.join(changed)}"
            ),
            resource_id=resource_id,
            incident_id=updated.assigned_incident_id,
            actor=actor,
            payload={"changed": changed, "new_values": updates},
        )
        return updated

    def delete(self, resource_id: str) -> bool:
        if resource_id not in self._store:
            return False
        res = self._store.pop(resource_id)
        event_service.record(
            event_type=EventType.RESOURCE_UPDATED,
            description=f"Resource {resource_id} ({res.type.value}) removed from active fleet.",
            resource_id=resource_id,
            actor="operator",
        )
        return True

    def reset(self) -> None:
        self._store.clear()
        self._seed()


# Module-level singleton
resource_store = ResourceStore()
