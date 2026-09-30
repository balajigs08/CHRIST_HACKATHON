"""Pure functions: compare two plans and explain the result using only system-state facts."""
from models.schemas import Assignment, Incident, PlanChange, ResourceStatus, UnassignedIncident


def _desc(inc: Incident) -> str:
    return f"{inc.id} ({inc.type}, {inc.severity.value})"


def diff_plans(previous: list[Assignment], new: list[Assignment], resources: dict,
               incidents: dict) -> list[PlanChange]:
    prev = {a.resource_id: a for a in previous if a.incident_id in incidents
            and incidents[a.incident_id].status.value != "resolved"}
    cur = {a.resource_id: a for a in new}
    changes: list[PlanChange] = []
    for rid, a in sorted(cur.items()):
        old = prev.get(rid)
        if old and old.incident_id == a.incident_id:
            continue
        inc = incidents[a.incident_id]
        if old:
            changes.append(PlanChange(kind="reallocated", resource_id=rid, from_incident=old.incident_id,
                                      to_incident=a.incident_id,
                                      text=f"{rid} was reallocated from {old.incident_id} to {_desc(inc)}. {a.reason}"))
        else:
            changes.append(PlanChange(kind="assigned", resource_id=rid, to_incident=a.incident_id,
                                      text=f"{rid} was assigned to {_desc(inc)}. {a.reason}"))
    for rid, old in sorted(prev.items()):
        if rid in cur:
            continue
        res = resources.get(rid)
        inc = incidents[old.incident_id]
        if res is not None and res.status in (ResourceStatus.unavailable, ResourceStatus.maintenance):
            reason = f" ({res.status_reason})" if res.status_reason else ""
            changes.append(PlanChange(kind="lost", resource_id=rid, from_incident=old.incident_id,
                                      text=f"{rid} became {res.status.value}{reason}, so {_desc(inc)} lost its {old.resource_type.value.replace('_', ' ')}."))
        else:
            changes.append(PlanChange(kind="released", resource_id=rid, from_incident=old.incident_id,
                                      text=f"{rid} was released from {old.incident_id} and is free again."))
    return changes


def build_explanation(trigger: str, changes: list[PlanChange], unassigned: list[UnassignedIncident],
                      incidents: dict, note: str = "") -> str:
    parts = [f"Trigger: {trigger}."]
    parts += [c.text for c in changes] or ["No assignment changes were required; the current plan is still optimal."]
    for u in unassigned:
        inc = incidents[u.incident_id]
        need = ", ".join(t.value.replace("_", " ") for t in u.missing_resources)
        parts.append(f"{_desc(inc)} is waiting for: {need}. {u.reason}")
    if note:
        parts.append(note)
    return " ".join(parts)
