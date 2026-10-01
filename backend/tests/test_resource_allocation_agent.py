"""Unit Tests for AI Phase 4 — Resource Allocation Agent (PuLP + CBC Optimization Integration)."""
from agents.base_agent import (
    IncidentAssessment,
    ResourceAllocation,
    ResourceAssignment,
)
from agents.resource_allocation_agent import ResourceAllocationAgent
from agents.agent_orchestrator import run_demo_pipeline


def get_raa():
    return ResourceAllocationAgent()


# ---------------------------------------------------------------------------
# 1. Single Incident Optimization Test
# ---------------------------------------------------------------------------
def test_single_incident_optimization():
    """Verify PuLP/CBC finds optimal assignment for single incident with fire and ambulance requirements."""
    raa = get_raa()
    incident = {
        "incident_id": "INC-001",
        "severity": "critical",
        "urgency": 9,
        "required_resources": ["fire_team", "ambulance"],
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    resources = [
        {"id": "F01", "name": "Fire Engine 1", "type": "fire_team", "status": "available", "latitude": 12.9700, "longitude": 77.5900, "capabilities": ["fire_suppression"]},
        {"id": "A01", "name": "Ambulance 1", "type": "ambulance", "status": "available", "latitude": 12.9750, "longitude": 77.6000, "capabilities": ["medical_transport"]},
    ]

    res = raa.execute({"incident": incident, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.allocation_status == "fully_allocated"
    assert len(alloc.allocated_resources) == 2
    assert len(alloc.unallocated_resource_types) == 0
    assert alloc.total_allocated == 2
    assert "PuLP" in alloc.reasoning or "Optimal" in alloc.reasoning


# ---------------------------------------------------------------------------
# 2. Multiple Competing Incidents Optimization Test
# ---------------------------------------------------------------------------
def test_multiple_competing_incidents():
    """Verify that PuLP/CBC maximizes global objective across multiple simultaneous competing incidents."""
    raa = get_raa()
    incidents = [
        {
            "id": "INC-HIGH-01",
            "severity": "high",
            "urgency": 8,
            "required_resources": ["ambulance"],
            "latitude": 12.9700,
            "longitude": 77.5900,
        },
        {
            "id": "INC-MED-02",
            "severity": "medium",
            "urgency": 5,
            "required_resources": ["ambulance"],
            "latitude": 12.9800,
            "longitude": 77.6000,
        },
    ]
    # Two ambulances available for two incidents
    resources = [
        {"id": "A01", "name": "Ambulance 1", "type": "ambulance", "status": "available", "latitude": 12.9710, "longitude": 77.5910, "capabilities": ["medical_transport"]},
        {"id": "A02", "name": "Ambulance 2", "type": "ambulance", "status": "available", "latitude": 12.9810, "longitude": 77.6010, "capabilities": ["medical_transport"]},
    ]

    res = raa.execute({"incidents": incidents, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.allocation_status == "fully_allocated"
    assert len(alloc.allocated_resources) == 2

    # Check distinct resources were assigned (no duplicate allocation)
    assigned_ids = [a.resource_id for a in alloc.allocated_resources]
    assert len(set(assigned_ids)) == 2


# ---------------------------------------------------------------------------
# 3. Critical vs Low-Priority Incident (Contested Resource) Test
# ---------------------------------------------------------------------------
def test_critical_vs_low_priority_incident():
    """Verify that PuLP optimizer allocates contested single resource to the critical incident over low priority."""
    raa = get_raa()
    incidents = [
        {
            "id": "INC-LOW",
            "severity": "low",
            "urgency": 2,
            "required_resources": ["ambulance"],
            "latitude": 12.9700,
            "longitude": 77.5900,
        },
        {
            "id": "INC-CRITICAL",
            "severity": "critical",
            "urgency": 10,
            "required_resources": ["ambulance"],
            "latitude": 12.9700,
            "longitude": 77.5900,
        },
    ]
    # Only ONE ambulance in the entire city
    resources = [
        {"id": "A-SOLO", "name": "Solo Ambulance", "type": "ambulance", "status": "available", "latitude": 12.9710, "longitude": 77.5910, "capabilities": ["medical_transport"]},
    ]

    res = raa.execute({"incidents": incidents, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.allocation_status == "partially_allocated"

    # Only 1 assignment made, and it MUST belong to the critical incident
    assert len(alloc.allocated_resources) == 1
    assert alloc.allocated_resources[0].incident_id == "INC-CRITICAL"
    assert alloc.allocated_resources[0].resource_id == "A-SOLO"
    assert "INC-LOW" in alloc.unassigned_incidents


# ---------------------------------------------------------------------------
# 4. Limited Resources & Shortage Detection Test
# ---------------------------------------------------------------------------
def test_limited_resources_shortage_detection():
    """Verify that shortages are detected and returned when demand exceeds available supply."""
    raa = get_raa()
    incident = {
        "id": "INC-MAJOR-FIRE",
        "severity": "critical",
        "urgency": 10,
        "required_resources": ["fire_team", "rescue_team", "police"],
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    # Only fire_team is available; rescue_team and police are missing
    resources = [
        {"id": "F01", "name": "Fire Engine 1", "type": "fire_team", "status": "available", "capabilities": ["fire_suppression"]},
    ]

    res = raa.execute({"incident": incident, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.allocation_status == "partially_allocated"
    assert len(alloc.allocated_resources) == 1
    assert "rescue_team" in alloc.unallocated_resource_types or "rescue_team" in alloc.missing_resources
    assert "police" in alloc.unallocated_resource_types or "police" in alloc.missing_resources


# ---------------------------------------------------------------------------
# 5. Incompatible Resources (Capabilities Mismatch) Test
# ---------------------------------------------------------------------------
def test_incompatible_resources_exclusion():
    """Verify that resources lacking the required capability are not allocated by PuLP."""
    raa = get_raa()
    incident = {
        "id": "INC-001",
        "severity": "critical",
        "urgency": 9,
        "required_resources": ["fire_team"],
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    # F-BAD is typed fire_team but has wrong/missing capabilities
    resources = [
        {"id": "F-BAD", "type": "fire_team", "status": "available", "capabilities": ["wrong_capability_only"]},
        {"id": "F-GOOD", "type": "fire_team", "status": "available", "capabilities": ["fire_suppression"]},
    ]

    res = raa.execute({"incident": incident, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.allocation_status == "fully_allocated"
    assert len(alloc.allocated_resources) == 1
    assert alloc.allocated_resources[0].resource_id == "F-GOOD"


# ---------------------------------------------------------------------------
# 6. Unavailable & Maintenance Resource Exclusion Test
# ---------------------------------------------------------------------------
def test_unavailable_and_maintenance_exclusion():
    """Verify that units marked 'unavailable' or 'maintenance' are strictly omitted from PuLP candidates."""
    raa = get_raa()
    incident = {
        "id": "INC-001",
        "severity": "high",
        "urgency": 8,
        "required_resources": ["ambulance"],
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    resources = [
        {"id": "A-UNAVAILABLE", "type": "ambulance", "status": "unavailable", "capabilities": ["medical_transport"]},
        {"id": "A-MAINTENANCE", "type": "ambulance", "status": "maintenance", "capabilities": ["medical_transport"]},
        {"id": "A-OK", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"]},
    ]

    res = raa.execute({"incident": incident, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.allocation_status == "fully_allocated"
    assert len(alloc.allocated_resources) == 1
    assert alloc.allocated_resources[0].resource_id == "A-OK"


# ---------------------------------------------------------------------------
# 7. No Feasible Allocation (Graceful Shortage Handling) Test
# ---------------------------------------------------------------------------
def test_no_feasible_allocation_handling():
    """Verify graceful handling when candidate pool is completely empty or all units are offline."""
    raa = get_raa()
    incident = {
        "id": "INC-001",
        "severity": "medium",
        "urgency": 5,
        "required_resources": ["ambulance", "police"],
        "latitude": 12.9716,
        "longitude": 77.5946,
    }

    res = raa.execute({"incident": incident, "resources": []})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.allocation_status == "unallocated"
    assert alloc.total_allocated == 0
    assert len(alloc.unallocated_resource_types) == 2


# ---------------------------------------------------------------------------
# 8. No Double-Booking Hard Constraint Test
# ---------------------------------------------------------------------------
def test_no_double_booking_constraint():
    """Verify hard mathematical constraint: one resource can never serve multiple incident slots."""
    raa = get_raa()
    # 3 incidents all competing for the same single available ambulance
    incidents = [
        {"id": "INC-A", "severity": "high", "urgency": 8, "required_resources": ["ambulance"], "latitude": 12.9700, "longitude": 77.5900},
        {"id": "INC-B", "severity": "critical", "urgency": 9, "required_resources": ["ambulance"], "latitude": 12.9710, "longitude": 77.5910},
        {"id": "INC-C", "severity": "medium", "urgency": 5, "required_resources": ["ambulance"], "latitude": 12.9720, "longitude": 77.5920},
    ]
    resources = [
        {"id": "AMB-SINGLE", "type": "ambulance", "status": "available", "capabilities": ["medical_transport"], "latitude": 12.9705, "longitude": 77.5905},
    ]

    res = raa.execute({"incidents": incidents, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert alloc.total_allocated == 1
    # AMB-SINGLE is only allocated once (to the highest priority incident INC-B)
    assigned_resource_ids = [a.resource_id for a in alloc.allocated_resources]
    assert assigned_resource_ids == ["AMB-SINGLE"]
    assert alloc.allocated_resources[0].incident_id == "INC-B"


# ---------------------------------------------------------------------------
# 9. Distance / ETA Preference in PuLP Objective Test
# ---------------------------------------------------------------------------
def test_eta_distance_preference_in_pulp():
    """Verify that PuLP solver picks the closer unit with lower ETA to maximize the objective function."""
    raa = get_raa()
    incident = {
        "id": "INC-KORAMANGALA",
        "severity": "high",
        "urgency": 8,
        "required_resources": ["ambulance"],
        "latitude": 12.9352,
        "longitude": 77.6245,  # Koramangala
    }
    resources = [
        {
            "id": "A-FAR",
            "name": "Far Ambulance (Whitefield)",
            "type": "ambulance",
            "status": "available",
            "capabilities": ["medical_transport"],
            "latitude": 12.9698,
            "longitude": 77.7500,  # ~14 km away
        },
        {
            "id": "A-NEAR",
            "name": "Near Ambulance (Indiranagar)",
            "type": "ambulance",
            "status": "available",
            "capabilities": ["medical_transport"],
            "latitude": 12.9380,
            "longitude": 77.6300,  # ~0.6 km away
        },
    ]

    res = raa.execute({"incident": incident, "resources": resources})
    assert res.success is True
    alloc: ResourceAllocation = res.data
    assert len(alloc.allocated_resources) == 1
    chosen = alloc.allocated_resources[0]

    assert chosen.resource_id == "A-NEAR"
    assert chosen.distance_km < 3.0


# ---------------------------------------------------------------------------
# 10. End-to-End Multi-Agent Pipeline Integration Test
# ---------------------------------------------------------------------------
def test_pipeline_integration_with_pulp_raa():
    """Verify full multi-agent orchestrator runs smoothly with PuLP/CBC RAA integration."""
    demo_res = run_demo_pipeline()
    assert demo_res.pipeline_status == "success"
    assert demo_res.allocation.allocation_status == "fully_allocated"
    assert len(demo_res.allocation.allocated_resources) == 3
    assert demo_res.plan.plan_status == "active"


if __name__ == "__main__":
    print("Running AI Phase 4 — PuLP/CBC Resource Allocation Agent Tests...")
    test_single_incident_optimization()
    test_multiple_competing_incidents()
    test_critical_vs_low_priority_incident()
    test_limited_resources_shortage_detection()
    test_incompatible_resources_exclusion()
    test_unavailable_and_maintenance_exclusion()
    test_no_feasible_allocation_handling()
    test_no_double_booking_constraint()
    test_eta_distance_preference_in_pulp()
    test_pipeline_integration_with_pulp_raa()
    print("All PuLP/CBC RAA tests passed successfully!")
