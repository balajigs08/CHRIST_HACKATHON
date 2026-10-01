"""Configuration settings for Crisis Command backend foundation (Phase 1)."""
import os
from functools import lru_cache
from typing import List, Optional, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment or defaults."""
    project_name: str = "Crisis Command"
    version: str = "1.0.0"
    description: str = "Multi-Agent Emergency Response & Resource Coordination Backend"
    env: str = "development"
    debug: bool = True

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    api_prefix: str = "/api"

    # CORS settings (supports comma-separated string or list)
    cors_origins: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Domain defaults (for services compatibility)
    default_capabilities: dict = {
        "ambulance": ["medical_transport", "basic_life_support"],
        "fire_team": ["fire_suppression", "hazmat_basic"],
        "rescue_team": ["search_and_rescue", "extrication"],
        "medical_unit": ["advanced_medical", "triage"],
        "shelter": ["shelter"],
        "police": ["perimeter_control", "traffic_management"],
    }
    required_capability: dict = {
        "ambulance": "medical_transport",
        "fire_team": "fire_suppression",
        "rescue_team": "search_and_rescue",
        "medical_unit": "advanced_medical",
        "shelter": "shelter",
        "police": "perimeter_control",
    }
    severity_weights: dict = {
        "critical": 100.0,
        "high": 80.0,
        "medium": 50.0,
        "low": 20.0,
    }
    urgency_by_severity: dict = {
        "critical": 10,
        "high": 8,
        "medium": 5,
        "low": 2,
    }
    city_center: tuple = (12.9716, 77.5946)
    llm_api_key: str = ""
    llm_model: str = "claude-haiku-4-5"
    llm_timeout: float = 8.0
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "crisis_command"
    mongodb_timeout_ms: int = 5000
    waiting_coefficient: float = 0.5
    max_waiting_bonus: float = 30.0
    urgency_weight: float = 1.0
    slot_base_value: float = 10.0
    eta_weight: float = 0.3
    completion_weight: float = 0.5
    stability_bonus: float = 5.0
    solver_time_limit: int = 10
    average_speed_kmh: float = 40.0
    road_circuity_factor: float = 1.3
    dispatch_delay_min: float = 1.0

    # Authority Environment Credentials (never stored in DB/MongoDB)
    authority_email: str = "authority@crisiscommand.gov"
    authority_password_hash: str = ""
    authority_password: str = "AuthorityPassword123!"
    authority_password_salt: str = "cc_authority_salt_2026"

    # SMTP Configuration
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_email: str = ""  # alias for smtp_username
    smtp_password: str = ""
    smtp_from_email: str = ""
    from_email: str = ""  # alias for smtp_from_email
    smtp_from_name: str = "Crisis Command"
    from_name: str = ""  # alias for smtp_from_name
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: float = 10.0

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("smtp_username", mode="before")
    @classmethod
    def resolve_smtp_username(cls, v: str) -> str:
        if not v:
            return os.getenv("SMTP_USERNAME") or os.getenv("SMTP_EMAIL") or os.getenv("SMTP_USER") or ""
        return v

    @field_validator("smtp_from_email", mode="before")
    @classmethod
    def resolve_smtp_from_email(cls, v: str) -> str:
        if not v:
            return (
                os.getenv("SMTP_FROM_EMAIL")
                or os.getenv("FROM_EMAIL")
                or os.getenv("SMTP_FROM")
                or os.getenv("SMTP_USERNAME")
                or os.getenv("SMTP_EMAIL")
                or ""
            )
        return v

    @field_validator("smtp_from_name", mode="before")
    @classmethod
    def resolve_smtp_from_name(cls, v: str) -> str:
        if not v or v == "Crisis Command":
            return os.getenv("SMTP_FROM_NAME") or os.getenv("FROM_NAME") or "Crisis Command"
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Cached singleton settings instance."""
    return Settings()


settings = get_settings()
