import asyncio
import dataclasses

import db.mongo as mongo_module
from fake_mongo import FakeMongoClient

# The test-suite never talks to a real MongoDB: every container gets its own in-memory fake unless a shared
# client is passed to fresh(). This must happen BEFORE services.container is imported, because that module
# builds the application-wide container (and its Mongo client) at import time.
mongo_module.create_client = lambda settings: FakeMongoClient()

from config import get_settings  # noqa: E402
from models.schemas import IncidentCreate  # noqa: E402
from services.container import build_container  # noqa: E402


def fresh(client=None, **overrides):
    """A brand-new isolated container (optionally with overridden settings / a shared fake Mongo client)."""
    return build_container(dataclasses.replace(get_settings(), llm_api_key="", **overrides), client=client)


def run(coro):
    return asyncio.run(coro)


def add(c, text, **kw):
    inc, plan = run(c.agent.create_incident(IncidentCreate(description=text, **kw)))
    return inc, plan


def assigned_pairs(plan):
    return {(a.incident_id, a.resource_id) for a in plan.assignments}


def event_types(c):
    return [e.event_type.value for e in c.log.list()]
