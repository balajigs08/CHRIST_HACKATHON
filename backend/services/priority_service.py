"""Equity-aware priority: effective = severity weight + capped waiting-time bonus (AI Phase 6A).

Deterministic mathematical fairness preventing starvation of unserved emergencies.
"""
from typing import Any, Dict
from config import Settings
from models.schemas import Incident, Severity


class PriorityService:
    def __init__(self, settings: Settings):
        self.s = settings

    def severity_priority(self, severity: Severity) -> float:
        """Base priority weight from incident severity."""
        return float(self.s.severity_weights[Severity(severity).value])

    def waiting_bonus(self, waiting_minutes: float) -> float:
        """Deterministic equity bonus scaling linearly with waiting time up to configured ceiling."""
        return round(
            min(self.s.max_waiting_bonus, self.s.waiting_coefficient * max(0.0, float(waiting_minutes))),
            2,
        )

    def effective_priority(self, incident: Incident) -> float:
        """Total composite priority including severity and equity waiting bonus."""
        return round(self.severity_priority(incident.severity) + self.waiting_bonus(incident.waiting_time), 2)

    def breakdown(self, incident: Incident) -> Dict[str, Any]:
        """Structured explainability breakdown of equity and priority components."""
        sev_base = self.severity_priority(incident.severity)
        wait_bonus = self.waiting_bonus(incident.waiting_time)
        effective = round(sev_base + wait_bonus, 2)
        return {
            "incident_id": incident.id,
            "severity": incident.severity.value,
            "severity_base": sev_base,
            "urgency": incident.urgency,
            "waiting_minutes": round(incident.waiting_time, 1),
            "waiting_bonus": wait_bonus,
            "effective_priority": effective,
            "equity_applied": wait_bonus > 0,
        }
