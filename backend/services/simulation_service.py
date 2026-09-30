"""Scenario templates for the simulation buttons. Text goes through the normal assessment agent."""
import random

from data.localities import LOCALITIES

TEMPLATES = {
    "road_accident": "Two-vehicle collision with injuries reported near {loc}.",
    "medical_emergency": "Medical emergency: elderly patient feeling weak and dizzy near {loc}.",
    "building_fire": "Major building fire near {loc}. Several people are trapped inside.",
    "critical": "Building collapse near {loc}. Multiple people trapped under debris.",
}

# Deterministic T=0 / T+10 demo scenario
DEMO_T0 = [
    "Two-vehicle collision with injuries reported near Koramangala.",
    "Major building fire near Whitefield. Several people are trapped inside.",
    "Medical emergency: elderly patient feeling weak and dizzy near Jayanagar.",
]
DEMO_T10 = "Building collapse near Indiranagar. Multiple people trapped under debris."


def random_incident_text(kind: str) -> str:
    loc = random.choice(list(LOCALITIES)).title()
    return TEMPLATES[kind].format(loc=loc)
