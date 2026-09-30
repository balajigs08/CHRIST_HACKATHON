"""Single place for every tunable value (weights, speeds, capabilities, LLM settings)."""
import os
from dataclasses import dataclass, field
from functools import lru_cache

try:  # optional
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # pragma: no cover
    pass


def _num(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return float(default)


@dataclass(frozen=True)
class Settings:
    # --- equity-aware priority: effective = severity_weight + min(max_bonus, coeff * minutes_waiting)
    severity_weights: dict = field(default_factory=lambda: {
        "critical": 100.0, "high": 80.0, "medium": 50.0, "low": 20.0})
    waiting_coefficient: float = field(default_factory=lambda: _num("WAITING_COEFFICIENT", 0.5))  # points / minute
    max_waiting_bonus: float = field(default_factory=lambda: _num("MAX_WAITING_BONUS", 30))

    # --- optimizer objective
    urgency_weight: float = 1.0        # extra value per urgency point (1-10)
    slot_base_value: float = 10.0      # keeps every feasible slot worth serving
    eta_weight: float = 0.3            # cost per minute of ETA
    completion_weight: float = 0.5     # bonus (x priority) when an incident is fully covered
    stability_bonus: float = 5.0       # small bonus for keeping an existing assignment
    solver_time_limit: int = field(default_factory=lambda: int(_num("SOLVER_TIME_LIMIT_SECONDS", 10)))

    # --- route / ETA simulation
    average_speed_kmh: float = field(default_factory=lambda: _num("AVERAGE_SPEED_KMH", 40))
    road_circuity_factor: float = 1.3  # straight-line -> road distance
    dispatch_delay_min: float = 1.0

    # --- capabilities
    default_capabilities: dict = field(default_factory=lambda: {
        "ambulance": ["medical_transport", "basic_life_support"],
        "fire_team": ["fire_suppression", "hazmat_basic"],
        "rescue_team": ["search_and_rescue", "extrication"],
        "medical_unit": ["advanced_medical", "triage"],
        "shelter": ["shelter"],
    })
    required_capability: dict = field(default_factory=lambda: {
        "ambulance": "medical_transport",
        "fire_team": "fire_suppression",
        "rescue_team": "search_and_rescue",
        "medical_unit": "advanced_medical",
        "shelter": "shelter",
    })

    # --- assessment
    urgency_by_severity: dict = field(default_factory=lambda: {
        "critical": 10, "high": 8, "medium": 5, "low": 2})
    city_center: tuple = (12.9716, 77.5946)  # Bengaluru

    # --- LLM (optional)
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "claude-haiku-4-5"))
    llm_timeout: float = field(default_factory=lambda: _num("LLM_TIMEOUT_SECONDS", 8))

    # --- MongoDB (system of record)
    mongodb_uri: str = field(default_factory=lambda: os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    mongodb_db: str = field(default_factory=lambda: os.getenv("MONGODB_DB", "crisis_command"))
    mongodb_timeout_ms: int = field(default_factory=lambda: int(_num("MONGODB_TIMEOUT_MS", 5000)))

    cors_origins: tuple = field(default_factory=lambda: tuple(
        o.strip() for o in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()))


@lru_cache
def get_settings() -> Settings:
    return Settings()
