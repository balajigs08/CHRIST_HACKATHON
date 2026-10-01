"""Incident Assessment Agent (IAA) — AI Phase 2.

Performs deterministic multi-factor incident analysis to extract:
- Incident classification & category
- Deterministic Severity (critical, high, medium, low)
- Multi-factor Urgency Score (1–10) incorporating incident factors & waiting time
- Standardized Required Resource Teams
- Confidence Score (0.0–1.0) based on report fidelity & completeness
- Structured, data-backed reasoning explaining the assessment decisions
- Robust, safe handling of missing or incomplete incident payloads
"""
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from agents.base_agent import BaseAgent, AgentResult, IncidentAssessment


# ---------------------------------------------------------------------------
# Structured Incident Type Knowledge Base & Rules
# ---------------------------------------------------------------------------

INCIDENT_TAXONOMY: Dict[str, Dict[str, Any]] = {
    "Building Fire": {
        "aliases": ["fire", "blaze", "flames", "smoke", "burning", "inferno", "commercial fire", "house fire"],
        "base_severity": "critical",
        "base_urgency": 9,
        "default_resources": ["fire_team", "ambulance", "rescue_team"],
        "reason_summary": "Structure fire with immediate threat of smoke inhalation, burns, and building collapse.",
        "resource_justification": "Fire Unit for active flame suppression, Ambulance for burn triage/transit, Rescue Team for victim extrication.",
    },
    "Road Accident": {
        "aliases": ["accident", "crash", "collision", "pile-up", "pileup", "overturned", "hit and run", "vehicle collision", "traffic crash"],
        "base_severity": "high",
        "base_urgency": 8,
        "default_resources": ["ambulance", "rescue_team", "police"],
        "reason_summary": "Roadway vehicular collision with risk of physical trauma, trapped passengers, and traffic obstruction.",
        "resource_justification": "Ambulance for medical triage, Rescue Team for vehicle extrication, Police Unit for perimeter and traffic control.",
    },
    "Medical Emergency": {
        "aliases": ["cardiac", "heart attack", "stroke", "unconscious", "cpr", "bleeding", "respiratory", "overdose", "medical", "seizure"],
        "base_severity": "critical",
        "base_urgency": 9,
        "default_resources": ["ambulance", "medical_unit"],
        "reason_summary": "Acute, time-sensitive medical distress requiring immediate advanced life support.",
        "resource_justification": "Ambulance for emergency transport, Medical Team for on-scene stabilization and advanced clinical care.",
    },
    "Chemical Spill": {
        "aliases": ["chemical spill", "chemical", "hazmat", "toxic", "gas leak", "fumes", "radiation", "acid spill", "hazardous material"],
        "base_severity": "critical",
        "base_urgency": 9,
        "default_resources": ["fire_team", "rescue_team", "medical_unit"],
        "reason_summary": "Hazardous toxic release with potential for chemical contamination, inhalation injuries, and widespread environmental exposure.",
        "resource_justification": "Fire Unit for hazardous containment, Rescue Team for contaminated area evacuation, Medical Team for toxicology triage.",
    },
    "Flooding": {
        "aliases": ["flood", "flooding", "waterlogging", "submerged", "overflow", "drowning", "heavy rain", "inundation", "water surge"],
        "base_severity": "medium",
        "base_urgency": 6,
        "default_resources": ["rescue_team", "shelter"],
        "reason_summary": "Water accumulation causing stranding, mobility disruption, and displacement of residents.",
        "resource_justification": "Rescue Team for boat/water evacuation, Shelter Unit for temporary displaced civilian housing.",
    },
    "Structural Collapse": {
        "aliases": ["collapse", "rubble", "building collapse", "debris", "earthquake", "fallen structure"],
        "base_severity": "critical",
        "base_urgency": 10,
        "default_resources": ["rescue_team", "fire_team", "ambulance", "medical_unit"],
        "reason_summary": "Major physical structural collapse with high probability of trapped victims under debris.",
        "resource_justification": "Rescue Team for urban search and rescue, Fire Unit for stabilization, Ambulance & Medical Team for trauma care.",
    },
    "Civil Disturbance": {
        "aliases": ["riot", "disturbance", "mob", "protest", "clash", "fight", "crowd control", "law and order"],
        "base_severity": "medium",
        "base_urgency": 6,
        "default_resources": ["police", "ambulance"],
        "reason_summary": "Public order disturbance with potential for localized violence and minor injuries.",
        "resource_justification": "Police Unit for crowd dispersal and area containment, Ambulance for casualty standby.",
    },
    "Minor Incident": {
        "aliases": ["minor", "fender bender", "small leak", "nuisance", "property damage", "debris on road", "maintenance", "non-urgent"],
        "base_severity": "low",
        "base_urgency": 3,
        "default_resources": ["police"],
        "reason_summary": "Low-risk incident without imminent threat to human life or major infrastructure.",
        "resource_justification": "Police Unit for non-emergency on-site reporting and documentation.",
    },
}

# Modifiers for severity adjustment
CRITICAL_TRIGGERS = [
    "trapped", "unconscious", "fatal", "mass casualty", "explosion", "cardiac arrest",
    "severe bleeding", "children trapped", "spreading rapidly", "toxic cloud", "dead", "structural failure",
]

HIGH_TRIGGERS = [
    "injured", "multiple vehicles", "heavy smoke", "blocked roadway", "flames visible",
    "fracture", "elderly", "rising water", "stranded", "gas smell", "head injury",
]

MITIGATING_TRIGGERS = [
    "minor", "no injuries", "contained", "controlled", "small", "cleared",
    "stable", "under control", "property only", "false alarm", "no casualties",
]


class IncidentAssessmentAgent(BaseAgent):
    """Incident Assessment Agent (IAA) provides deterministic multi-factor emergency assessment."""

    def __init__(self, settings=None):
        super().__init__(
            name="Incident Assessment Agent",
            description="Analyzes incident parameters, severity, urgency (1-10), waiting time, and required emergency capabilities.",
        )
        self.settings = settings

    def execute(self, input_data: Any) -> AgentResult:
        """
        Execute incident assessment.

        Args:
            input_data: Dict or schema containing incident information.
        """
        try:
            # 1. Safe normalization of input data
            data = self._normalize_input(input_data)

            incident_id = data.get("incident_id") or data.get("id") or "INC-UNKNOWN"
            raw_title = str(data.get("title") or "")
            raw_type = str(data.get("type") or "")
            raw_desc = str(data.get("description") or "")
            raw_loc = str(data.get("location") or data.get("address") or "")
            provided_severity = data.get("severity")
            provided_urgency = data.get("urgency")
            provided_resources = data.get("required_resources")
            waiting_time = self._extract_waiting_time(data)

            # Combined text for keyword extraction
            combined_text = f"{raw_title} {raw_type} {raw_desc} {raw_loc}".strip().lower()

            # 2. Handle completely empty or missing information
            is_missing_info = len(combined_text) == 0

            # 3. Classify Incident Type
            incident_type, matched_rule, match_count = self._classify_incident_type(raw_type, combined_text)

            # 4. Calculate Severity & Urgency
            severity, urgency, reasoning_parts, confidence = self._compute_severity_and_urgency(
                matched_rule=matched_rule,
                combined_text=combined_text,
                provided_severity=provided_severity,
                provided_urgency=provided_urgency,
                waiting_time=waiting_time,
                is_missing_info=is_missing_info,
                match_count=match_count,
            )

            # 5. Determine Required Resources
            required_resources, resource_reasoning = self._determine_resources(
                matched_rule=matched_rule,
                provided_resources=provided_resources,
                severity=severity,
                combined_text=combined_text,
            )

            # 6. Format Location
            location_dict = self._format_location(data)

            # 7. Assemble Structured Reasoning
            final_reasoning = (
                f"[{incident_type.upper()}] {reasoning_parts['severity_reason']} "
                f"Urgency assessed at {urgency}/10 ({reasoning_parts['urgency_reason']}). "
                f"Resource Deployment: {resource_reasoning}"
            )
            if waiting_time > 0:
                final_reasoning += f" [Waiting Time Factor: {round(waiting_time, 1)} min unaddressed]."
            if is_missing_info:
                final_reasoning += " [Warning: Incomplete report details; baseline safety protocol applied]."

            # 8. Build Pydantic Model
            assessment = IncidentAssessment(
                incident_id=incident_id,
                incident_type=incident_type,
                severity=severity,
                urgency=urgency,
                required_resources=required_resources,
                confidence=round(confidence, 2),
                reasoning=final_reasoning,
                location=location_dict,
                waiting_time_minutes=round(waiting_time, 1),
                assessed_at=datetime.utcnow(),
            )

            return self._success_result(
                data=assessment,
                message=f"Assessment complete: {incident_type} | Severity: {severity.upper()} | Urgency: {urgency}/10",
            )

        except Exception as exc:
            return self._error_result(f"Incident assessment failed: {str(exc)}")

    # -------------------------------------------------------------------------
    # Helper Methods
    # -------------------------------------------------------------------------

    def _normalize_input(self, input_data: Any) -> Dict[str, Any]:
        """Safely convert any input format to a clean dictionary."""
        if input_data is None:
            return {}
        if isinstance(input_data, dict):
            return dict(input_data)
        if hasattr(input_data, "model_dump"):
            return input_data.model_dump()
        if hasattr(input_data, "__dict__"):
            return vars(input_data)
        if isinstance(input_data, str):
            return {"description": input_data}
        return {"description": str(input_data)}

    def _extract_waiting_time(self, data: Dict[str, Any]) -> float:
        """Extract waiting time in minutes from various possible input fields."""
        for key in ("waiting_time", "waiting_time_minutes", "waiting_time_min", "waiting_min", "waiting_minutes"):
            val = data.get(key)
            if val is not None:
                try:
                    return max(0.0, float(val))
                except (ValueError, TypeError):
                    pass
        return 0.0

    def _classify_incident_type(
        self, raw_type: str, text: str
    ) -> Tuple[str, Dict[str, Any], int]:
        """Classify the incident into a standardized taxonomy type."""
        # Check direct alias matching first
        raw_type_clean = raw_type.strip().lower()
        for itype, info in INCIDENT_TAXONOMY.items():
            if raw_type_clean == itype.lower() or raw_type_clean in info["aliases"]:
                return itype, info, 3

        # Keyword matching against text
        best_type = None
        best_info = None
        max_matches = 0

        for itype, info in INCIDENT_TAXONOMY.items():
            hits = 0
            for alias in info["aliases"]:
                if re.search(r"\b" + re.escape(alias) + r"\b", text):
                    hits += 1
            if hits > max_matches:
                max_matches = hits
                best_type = itype
                best_info = info

        if best_type and best_info:
            return best_type, best_info, max_matches

        # Fallback if no keywords matched
        fallback_type = raw_type if raw_type.strip() else "General Emergency"
        fallback_info = {
            "base_severity": "medium",
            "base_urgency": 5,
            "default_resources": ["ambulance", "police"],
            "reason_summary": "Unclassified incident evaluated with standard emergency response procedures.",
            "resource_justification": "Ambulance and Police dispatched for initial on-scene evaluation.",
        }
        return fallback_type, fallback_info, 0

    def _compute_severity_and_urgency(
        self,
        matched_rule: Dict[str, Any],
        combined_text: str,
        provided_severity: Optional[str],
        provided_urgency: Optional[Any],
        waiting_time: float,
        is_missing_info: bool,
        match_count: int,
    ) -> Tuple[str, int, Dict[str, str], float]:
        """Compute severity level, urgency score (1-10), explanation, and confidence."""
        base_sev = matched_rule["base_severity"]
        base_urg = matched_rule["base_urgency"]

        # 1. Analyze situational keywords
        critical_hits = [w for w in CRITICAL_TRIGGERS if re.search(r"\b" + re.escape(w) + r"\b", combined_text)]
        high_hits = [w for w in HIGH_TRIGGERS if re.search(r"\b" + re.escape(w) + r"\b", combined_text)]
        mitigating_hits = [w for w in MITIGATING_TRIGGERS if re.search(r"\b" + re.escape(w) + r"\b", combined_text)]

        # 2. Determine Severity
        severity = base_sev
        severity_explanation = matched_rule["reason_summary"]

        if critical_hits:
            severity = "critical"
            severity_explanation += f" Escalated to CRITICAL due to life-threat triggers: ({', '.join(critical_hits)})."
        elif high_hits and base_sev in ("medium", "low"):
            severity = "high"
            severity_explanation += f" Escalated to HIGH due to operational risk triggers: ({', '.join(high_hits)})."
        elif mitigating_hits and not critical_hits:
            if base_sev == "critical":
                severity = "high"
                severity_explanation += f" De-escalated to HIGH due to mitigating indicators: ({', '.join(mitigating_hits)})."
            elif base_sev in ("high", "medium"):
                severity = "low"
                severity_explanation += f" De-escalated to LOW due to controlled/minor status: ({', '.join(mitigating_hits)})."

        # User explicit severity override (if valid)
        if provided_severity and str(provided_severity).lower() in ("critical", "high", "medium", "low"):
            severity = str(provided_severity).lower()

        # 3. Determine Urgency Score (1-10)
        calculated_urgency = base_urg

        # Modifiers based on severity level
        sev_urgency_map = {"critical": 9, "high": 7, "medium": 5, "low": 3}
        calculated_urgency = max(calculated_urgency, sev_urgency_map.get(severity, 5))

        if critical_hits:
            calculated_urgency += min(2, len(critical_hits))
        elif high_hits:
            calculated_urgency += 1

        if mitigating_hits and not critical_hits:
            calculated_urgency -= min(3, len(mitigating_hits) * 2)

        # 4. Waiting Time Urgency Boost
        # +1 for >= 10m, +2 for >= 20m, +3 for >= 30m
        waiting_boost = 0
        if waiting_time >= 30.0:
            waiting_boost = 3
        elif waiting_time >= 20.0:
            waiting_boost = 2
        elif waiting_time >= 10.0:
            waiting_boost = 1

        calculated_urgency += waiting_boost

        # If waiting > 30 minutes and severity is medium/low, escalate severity to prevent starvation
        if waiting_time >= 30.0 and severity in ("medium", "low"):
            severity = "high"
            severity_explanation += " Escalated to HIGH due to prolonged wait time (>30 min starvation prevention)."

        # User explicit urgency override
        if provided_urgency is not None:
            try:
                p_urg = int(provided_urgency)
                if 1 <= p_urg <= 10:
                    calculated_urgency = p_urg + waiting_boost
            except (ValueError, TypeError):
                pass

        # Final Clamp to range 1..10
        final_urgency = max(1, min(10, calculated_urgency))

        urgency_reason = f"Base factor {base_urg}"
        if critical_hits or high_hits:
            urgency_reason += f" + situational severity impact"
        if mitigating_hits:
            urgency_reason += f" - containment discount"
        if waiting_boost > 0:
            urgency_reason += f" + {waiting_boost} wait-time bonus ({waiting_time:.0f} min)"

        # 5. Calculate Confidence Score
        confidence = 0.85
        if is_missing_info:
            confidence = 0.35
        else:
            if match_count > 0:
                confidence = min(0.98, 0.70 + (match_count * 0.08))
            else:
                confidence = 0.60
            if len(critical_hits) > 0 or len(high_hits) > 0:
                confidence = min(0.98, confidence + 0.05)

        reasoning_dict = {
            "severity_reason": severity_explanation,
            "urgency_reason": urgency_reason,
        }

        return severity, final_urgency, reasoning_dict, confidence

    def _determine_resources(
        self,
        matched_rule: Dict[str, Any],
        provided_resources: Optional[Any],
        severity: str,
        combined_text: str,
    ) -> Tuple[List[str], str]:
        """Determine required resource units based on incident category and modifiers."""
        base_resources = list(matched_rule.get("default_resources", ["ambulance", "police"]))
        resource_reason = matched_rule.get("resource_justification", "Standard emergency units allocated.")

        # Additional contextual resources
        if "fire" in combined_text and "fire_team" not in base_resources:
            base_resources.append("fire_team")
        if ("trapped" in combined_text or "extrication" in combined_text) and "rescue_team" not in base_resources:
            base_resources.append("rescue_team")
        if ("cardiac" in combined_text or "burn" in combined_text or "critical injury" in combined_text) and "medical_unit" not in base_resources:
            base_resources.append("medical_unit")
        if ("traffic" in combined_text or "crowd" in combined_text or "perimeter" in combined_text) and "police" not in base_resources:
            base_resources.append("police")

        # Merge with user provided resources if any
        if provided_resources and isinstance(provided_resources, list):
            for res in provided_resources:
                if str(res) not in base_resources:
                    base_resources.append(str(res))

        # Deduplicate while preserving order
        final_resources = list(dict.fromkeys(base_resources))
        return final_resources, resource_reason

    def _format_location(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Format location into a clean structure."""
        loc = data.get("location")
        lat = data.get("latitude")
        lon = data.get("longitude")

        if lat is not None and lon is not None:
            try:
                return {
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "address": str(loc) if loc else None,
                }
            except (ValueError, TypeError):
                pass

        if loc:
            if isinstance(loc, dict):
                return loc
            return {"address": str(loc)}

        return None

    def assess(
        self,
        text: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        waiting_time: float = 0.0,
    ) -> Any:
        """Deterministic rule-based assessment returning AssessmentResult."""
        from data.assessment_rules import (
            DEFAULT_REQUIRED,
            DEFAULT_SEVERITY,
            DEFAULT_TYPE,
            EXTRA_RESOURCES,
            INCIDENT_RULES,
            SEVERITY_DOWN,
            SEVERITY_UP,
            URGENCY_BOOST,
        )
        from data.localities import LOCALITIES
        from models.schemas import AssessmentResult, Location, ResourceType, Severity

        text_lower = text.lower()

        # 1. Match Locality Coordinates
        loc_name = None
        loc_lat, loc_lon = lat, lon
        for name, coords in LOCALITIES.items():
            if name in text_lower:
                loc_name = name.title()
                if loc_lat is None:
                    loc_lat, loc_lon = coords
                break

        if loc_lat is None or loc_lon is None:
            loc_lat, loc_lon = self.settings.city_center if self.settings else (12.9716, 77.5946)

        # 2. Score Incident Type
        scores: Dict[str, int] = {}
        for itype, spec in INCIDENT_RULES.items():
            score = sum(w for phrase, w in spec["keywords"].items() if phrase in text_lower)
            if score > 0:
                scores[itype] = score

        if scores:
            best_type = max(scores.items(), key=lambda kv: kv[1])[0]
            confidence = min(0.95, 0.5 + scores[best_type] * 0.1)
        else:
            best_type = DEFAULT_TYPE
            confidence = 0.4

        rule = INCIDENT_RULES.get(best_type, {
            "base_severity": DEFAULT_SEVERITY,
            "required": DEFAULT_REQUIRED,
        })

        # 3. Adjust Severity
        sev_num = rule["base_severity"]
        if any(w in text_lower for w in SEVERITY_UP):
            sev_num = min(4, sev_num + 1)
        elif any(w in text_lower for w in SEVERITY_DOWN):
            sev_num = max(1, sev_num - 1)

        sev_map = {1: Severity.low, 2: Severity.medium, 3: Severity.high, 4: Severity.critical}
        severity = sev_map.get(sev_num, Severity.medium)

        # 4. Urgency
        urgency_base = {Severity.critical: 9, Severity.high: 7, Severity.medium: 5, Severity.low: 2}
        urgency = urgency_base.get(severity, 5)
        if any(w in text_lower for w in URGENCY_BOOST):
            urgency = min(10, urgency + 2)

        # 5. Required Resources
        req_strings = list(rule.get("required", DEFAULT_REQUIRED))
        for key, extra_res in EXTRA_RESOURCES.get(best_type, {}).items():
            if key in text_lower and extra_res not in req_strings:
                req_strings.append(extra_res)

        req_enums = [ResourceType(r) for r in req_strings if r in [rt.value for rt in ResourceType]]

        location_obj = Location(latitude=loc_lat, longitude=loc_lon, name=loc_name)
        explanation = f"Evaluated rules for '{best_type}': severity={severity.value}, urgency={urgency}/10."

        return AssessmentResult(
            incident_type=best_type,
            severity=severity,
            urgency=urgency,
            location=location_obj,
            required_resources=req_enums,
            confidence=round(confidence, 2),
            explanation=explanation,
            source="rules",
        )

