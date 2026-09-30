"""Incident Assessment Agent: free text -> structured incident.

Uses an LLM when LLM_API_KEY is configured, otherwise (or on any LLM failure) a deterministic
rule engine. It recommends resource TYPES only - never specific units."""
import re
from typing import Optional

from agents.llm_client import llm_assess
from config import Settings
from data.assessment_rules import (DEFAULT_REQUIRED, DEFAULT_SEVERITY, DEFAULT_TYPE, EXTRA_RESOURCES,
                                   INCIDENT_RULES, SEVERITY_DOWN, SEVERITY_UP, URGENCY_BOOST)
from data.localities import LOCALITIES
from models.schemas import AssessmentResult, Location, ResourceType, Severity

_ORDER = [Severity.low, Severity.medium, Severity.high, Severity.critical]


def _has(text: str, phrase: str) -> bool:
    return re.search(r"\b" + re.escape(phrase), text) is not None


class IncidentAssessmentAgent:
    def __init__(self, settings: Settings):
        self.s = settings

    # ------------------------------------------------------------ location
    def locate(self, text: str, lat: Optional[float], lon: Optional[float]) -> Location:
        low = text.lower()
        name = next((n for n in sorted(LOCALITIES, key=len, reverse=True) if _has(low, n)), None)
        if lat is not None and lon is not None:
            return Location(latitude=lat, longitude=lon, name=name.title() if name else None)
        if name:
            la, lo = LOCALITIES[name]
            return Location(latitude=la, longitude=lo, name=name.title())
        la, lo = self.s.city_center
        return Location(latitude=la, longitude=lo, name=None)

    # ------------------------------------------------------------ rules
    def _rule_assess(self, text: str, location: Location) -> AssessmentResult:
        low = text.lower()
        scores = {}
        for itype, rule in INCIDENT_RULES.items():
            hits = [(k, w) for k, w in rule["keywords"].items() if _has(low, k)]
            if hits:
                scores[itype] = (sum(w for _, w in hits), [k for k, _ in hits])

        if scores:
            itype = max(scores, key=lambda t: scores[t][0])  # dict order breaks ties
            score, hits = scores[itype]
            rule = INCIDENT_RULES[itype]
            level, required = rule["base_severity"], list(rule["required"])
            confidence = min(0.95, 0.55 + 0.08 * score)
        else:
            itype, hits, level, required = DEFAULT_TYPE, [], DEFAULT_SEVERITY, list(DEFAULT_REQUIRED)
            confidence = 0.3

        up = [k for k in SEVERITY_UP if _has(low, k)]
        down = [k for k in SEVERITY_DOWN if _has(low, k)]
        delta = (1 if up else 0) - (1 if down else 0)
        level = max(1, min(4, level + delta))
        severity = _ORDER[level - 1]

        boost = any(_has(low, k) for k in URGENCY_BOOST)
        urgency = min(10, self.s.urgency_by_severity[severity.value] + (1 if boost else 0))

        for kw, extra in EXTRA_RESOURCES.get(itype, {}).items():
            if _has(low, kw) and extra not in required:
                required.append(extra)

        why = (f"Matched keywords {hits} -> {itype}." if hits
               else "No known keywords matched; defaulted to a general emergency needing an ambulance (manual review advised).")
        if up:
            why += f" Severity raised by {up}."
        if down:
            why += f" Severity lowered by {down}."
        return AssessmentResult(
            incident_type=itype, severity=severity, urgency=urgency, location=location,
            required_resources=[ResourceType(r) for r in required],
            confidence=round(confidence, 2), explanation=why, source="rules")

    # ------------------------------------------------------------ public
    def assess(self, text: str, lat: Optional[float] = None, lon: Optional[float] = None) -> AssessmentResult:
        location = self.locate(text, lat, lon)
        llm = llm_assess(text, self.s)
        if llm:
            return AssessmentResult(
                incident_type=str(llm["incident_type"]).strip().lower().replace(" ", "_"),
                severity=Severity(llm["severity"]), urgency=llm["urgency"], location=location,
                required_resources=[ResourceType(r) for r in llm["required_resources"]],
                confidence=llm["confidence"], explanation=str(llm.get("explanation", "LLM assessment")),
                source="llm")
        return self._rule_assess(text, location)
