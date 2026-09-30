"""Optional LLM structured extraction. Returns None on any problem so the caller falls back to rules.
The LLM only classifies the report; it never sees resources and never assigns them."""
import json
import re
from typing import Optional

from config import Settings
from models.schemas import ResourceType, Severity

PROMPT = (
    "You are an emergency dispatch text classifier. Read the report and answer with ONLY a JSON object: "
    '{"incident_type": str (snake_case), "severity": "critical|high|medium|low", "urgency": int 1-10, '
    '"required_resources": [subset of ambulance, fire_team, rescue_team, medical_unit, shelter], '
    '"confidence": float 0-1, "explanation": str}. Do not assign specific units.'
)


def llm_assess(text: str, settings: Settings) -> Optional[dict]:
    if not settings.llm_api_key:
        return None
    try:
        import httpx

        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.llm_api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": settings.llm_model, "max_tokens": 400, "system": PROMPT,
                  "messages": [{"role": "user", "content": text}]},
            timeout=settings.llm_timeout,
        )
        r.raise_for_status()
        raw = "".join(b.get("text", "") for b in r.json().get("content", []))
        data = json.loads(re.search(r"\{.*\}", raw, re.S).group(0))
        Severity(data["severity"])
        data["required_resources"] = [ResourceType(x).value for x in data["required_resources"]]
        data["urgency"] = max(1, min(10, int(data["urgency"])))
        data["confidence"] = max(0.0, min(1.0, float(data.get("confidence", 0.7))))
        if not data["required_resources"] or not str(data.get("incident_type", "")).strip():
            return None
        return data
    except Exception:
        return None
