"""Equity-aware priority: effective = severity weight + capped waiting-time bonus."""
from config import Settings
from models.schemas import Incident, Severity


class PriorityService:
    def __init__(self, settings: Settings):
        self.s = settings

    def severity_priority(self, severity: Severity) -> float:
        return float(self.s.severity_weights[Severity(severity).value])

    def waiting_bonus(self, waiting_minutes: float) -> float:
        return min(self.s.max_waiting_bonus, self.s.waiting_coefficient * max(0.0, waiting_minutes))

    def effective_priority(self, incident: Incident) -> float:
        return round(self.severity_priority(incident.severity) + self.waiting_bonus(incident.waiting_time), 2)
