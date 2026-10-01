"""Unit Tests for AI Phase 2 — Incident Assessment Agent (IAA)."""
from agents.base_agent import IncidentAssessment, AgentResult
from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.agent_orchestrator import run_demo_pipeline


def get_iaa():
    return IncidentAssessmentAgent()


# ---------------------------------------------------------------------------
# 1. Critical Incident Test
# ---------------------------------------------------------------------------
def test_critical_incident_assessment():
    """Verify that high-risk life-threatening incidents are classified as CRITICAL with urgency 9-10."""
    iaa = get_iaa()
    payload = {
        "incident_id": "INC-CRIT-001",
        "title": "Commercial Complex Inferno",
        "type": "Building Fire",
        "description": "Multi-storey commercial building fire. Heavy smoke and 5 people trapped on the 4th floor.",
        "location": "Whitefield ITPL Road",
        "latitude": 12.9698,
        "longitude": 77.7500,
    }
    result = iaa.execute(payload)
    assert result.success is True
    assert isinstance(result.data, IncidentAssessment)
    ass: IncidentAssessment = result.data

    assert ass.severity == "critical"
    assert 9 <= ass.urgency <= 10
    assert "fire_team" in ass.required_resources
    assert "ambulance" in ass.required_resources
    assert "rescue_team" in ass.required_resources
    assert "CRITICAL" in ass.reasoning.upper()
    assert ass.confidence >= 0.8


# ---------------------------------------------------------------------------
# 2. High Severity Incident Test
# ---------------------------------------------------------------------------
def test_high_severity_incident_assessment():
    """Verify that multi-vehicle road collisions are classified as HIGH severity with urgency 7-9."""
    iaa = get_iaa()
    payload = {
        "incident_id": "INC-HIGH-001",
        "type": "Road Accident",
        "description": "3-car pile-up on Outer Ring Road near flyover. 2 injured, traffic completely blocked.",
        "location": "Outer Ring Road, Marathahalli",
        "latitude": 12.9591,
        "longitude": 77.6974,
    }
    result = iaa.execute(payload)
    assert result.success is True
    ass: IncidentAssessment = result.data

    assert ass.severity in ("high", "critical")
    assert 7 <= ass.urgency <= 10
    assert "ambulance" in ass.required_resources
    assert "police" in ass.required_resources
    assert len(ass.reasoning) > 0


# ---------------------------------------------------------------------------
# 3. Medium Severity Incident Test
# ---------------------------------------------------------------------------
def test_medium_severity_incident_assessment():
    """Verify that flooding/waterlogging without casualties is classified as MEDIUM severity."""
    iaa = get_iaa()
    payload = {
        "incident_id": "INC-MED-001",
        "type": "Flooding",
        "description": "Severe waterlogging near Silk Board junction. Several cars stranded in water, no injuries reported.",
        "location": "Silk Board Junction",
        "latitude": 12.9172,
        "longitude": 77.6228,
    }
    result = iaa.execute(payload)
    assert result.success is True
    ass: IncidentAssessment = result.data

    assert ass.severity == "medium"
    assert 4 <= ass.urgency <= 7
    assert "rescue_team" in ass.required_resources or "shelter" in ass.required_resources
    assert ass.confidence > 0.6


# ---------------------------------------------------------------------------
# 4. Low Severity Incident Test
# ---------------------------------------------------------------------------
def test_low_severity_incident_assessment():
    """Verify that minor fender benders / non-emergencies are classified as LOW severity."""
    iaa = get_iaa()
    payload = {
        "incident_id": "INC-LOW-001",
        "type": "Minor Incident",
        "description": "Minor fender bender in parking lot. No injuries, property damage only. Drivers exchanging info.",
        "location": "Koramangala 4th Block",
    }
    result = iaa.execute(payload)
    assert result.success is True
    ass: IncidentAssessment = result.data

    assert ass.severity == "low"
    assert 1 <= ass.urgency <= 5
    assert "police" in ass.required_resources
    assert "LOW" in ass.reasoning.upper() or "controlled" in ass.reasoning.lower() or "minor" in ass.reasoning.lower()


# ---------------------------------------------------------------------------
# 5. Missing / Incomplete Information Handling
# ---------------------------------------------------------------------------
def test_missing_or_incomplete_data():
    """Verify safe fallback and degradation when payload is empty or missing fields."""
    iaa = get_iaa()
    # Empty dictionary
    res_empty = iaa.execute({})
    assert res_empty.success is True
    assert isinstance(res_empty.data, IncidentAssessment)
    assert res_empty.data.severity in ("critical", "high", "medium", "low")
    assert 1 <= res_empty.data.urgency <= 10
    assert len(res_empty.data.required_resources) > 0
    assert res_empty.data.confidence < 0.6  # Low confidence on empty payload

    # None input
    res_none = iaa.execute(None)
    assert res_none.success is True
    assert isinstance(res_none.data, IncidentAssessment)

    # String description only
    res_str = iaa.execute("Chemical tank leaking pungent toxic fumes near residential colony.")
    assert res_str.success is True
    assert res_str.data.incident_type == "Chemical Spill"
    assert res_str.data.severity == "critical"


# ---------------------------------------------------------------------------
# 6. Specific Incident Types and Required Resources Mapping
# ---------------------------------------------------------------------------
def test_incident_types_and_resource_mappings():
    """Verify exact resource requirements for specified domain incident types."""
    iaa = get_iaa()
    # 1. Road accident -> Ambulance, Rescue Team, Police Unit
    r_road = iaa.execute({"type": "Road Accident", "description": "Car collision on expressway."}).data
    assert "ambulance" in r_road.required_resources
    assert "rescue_team" in r_road.required_resources
    assert "police" in r_road.required_resources

    # 2. Building fire -> Fire Unit, Ambulance, Rescue Team
    r_fire = iaa.execute({"type": "Building Fire", "description": "Factory fire with flames visible."}).data
    assert "fire_team" in r_fire.required_resources
    assert "ambulance" in r_fire.required_resources
    assert "rescue_team" in r_fire.required_resources

    # 3. Medical emergency -> Ambulance, Medical Team
    r_med = iaa.execute({"type": "Medical Emergency", "description": "Patient experiencing sudden cardiac arrest."}).data
    assert "ambulance" in r_med.required_resources
    assert "medical_unit" in r_med.required_resources

    # 4. Chemical spill -> Fire Unit, Rescue Team, Medical Team
    r_chem = iaa.execute({"type": "Chemical Spill", "description": "Acid spill from overturned tanker."}).data
    assert "fire_team" in r_chem.required_resources
    assert "rescue_team" in r_chem.required_resources
    assert "medical_unit" in r_chem.required_resources


# ---------------------------------------------------------------------------
# 7. High Waiting Time Escalation
# ---------------------------------------------------------------------------
def test_waiting_time_urgency_escalation():
    """Verify that prolonged waiting time increases urgency and prevents starvation."""
    iaa = get_iaa()
    base_payload = {
        "incident_id": "INC-WAIT-001",
        "type": "Flooding",
        "description": "Localized water accumulation on street.",
    }

    # 0 min wait
    res_0 = iaa.execute({**base_payload, "waiting_time": 0.0}).data
    # 15 min wait (+1 boost)
    res_15 = iaa.execute({**base_payload, "waiting_time": 15.0}).data
    # 35 min wait (+3 boost & escalation)
    res_35 = iaa.execute({**base_payload, "waiting_time": 35.0}).data

    assert res_15.urgency > res_0.urgency
    assert res_35.urgency >= res_15.urgency
    assert res_35.waiting_time_minutes == 35.0
    assert "waiting time" in res_35.reasoning.lower() or "unaddressed" in res_35.reasoning.lower()


# ---------------------------------------------------------------------------
# 8. Full Multi-Agent Pipeline Compatibility
# ---------------------------------------------------------------------------
def test_pipeline_integration_with_improved_iaa():
    """Verify the orchestrator still completes end-to-end with the improved IAA."""
    demo_res = run_demo_pipeline()
    assert demo_res.pipeline_status == "success"
    assert demo_res.assessment.confidence > 0.7
    assert len(demo_res.assessment.reasoning) > 0
    assert demo_res.plan.plan_status in ("active", "requires_attention")


if __name__ == "__main__":
    print("Running Incident Assessment Agent Tests...")
    test_critical_incident_assessment()
    test_high_severity_incident_assessment()
    test_medium_severity_incident_assessment()
    test_low_severity_incident_assessment()
    test_missing_or_incomplete_data()
    test_incident_types_and_resource_mappings()
    test_waiting_time_urgency_escalation()
    test_pipeline_integration_with_improved_iaa()
    print("All tests passed successfully!")
