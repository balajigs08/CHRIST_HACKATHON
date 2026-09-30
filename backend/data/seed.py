"""Initial demo resources (simulated coordinates around Bengaluru)."""
from config import Settings
from models.schemas import Resource, ResourceType, ResourceStatus

_SEED = [
    ("A01", ResourceType.ambulance, 12.9716, 77.5946),   # Cubbon Park
    ("A02", ResourceType.ambulance, 12.9784, 77.6408),   # Indiranagar
    ("A03", ResourceType.ambulance, 12.9250, 77.5938),   # Jayanagar
    ("F01", ResourceType.fire_team, 12.9698, 77.7500),   # Whitefield
    ("F02", ResourceType.fire_team, 13.0358, 77.5970),   # Hebbal
    ("R01", ResourceType.rescue_team, 12.9609, 77.6387),  # Domlur
    ("M01", ResourceType.medical_unit, 12.9857, 77.6057),  # Shivajinagar
    ("S01", ResourceType.shelter, 13.0035, 77.5647),     # Malleshwaram
]


def initial_resources(settings: Settings) -> list[Resource]:
    return [
        Resource(id=i, type=t, latitude=la, longitude=lo, status=ResourceStatus.available,
                 capabilities=list(settings.default_capabilities[t.value]))
        for i, t, la, lo in _SEED
    ]
