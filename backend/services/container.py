"""Wires every component together. api/* imports the module-level `container`."""
import asyncio
import logging
from dataclasses import dataclass
from typing import Optional


from agents.command_planning_agent import CommandPlanningAgent
from agents.incident_assessment_agent import IncidentAssessmentAgent
from agents.resource_allocation_agent import ResourceAllocationAgent
from config import Settings, get_settings
from db import mongo
from db.mongo import MongoPersistence
from events.event_log import EventLog
from events.ws_manager import ConnectionManager
from optimization.resource_optimizer import ResourceOptimizer
from services.clock import SimClock
from services.priority_service import PriorityService
from services.route_service import RouteService
from services.state_store import StateStore
from services.authority_store import authority_store


@dataclass
class Container:
    settings: Settings
    store: StateStore
    log: EventLog
    ws: ConnectionManager
    assessor: IncidentAssessmentAgent
    allocator: ResourceAllocationAgent
    agent: CommandPlanningAgent
    persistence: Optional[MongoPersistence] = None

    def _startup_sync(self) -> None:
        if not self.persistence:
            return
        self.persistence.connect()
        if self.persistence.healthy:
            if not self.persistence.restore(self.store, self.log, self.agent.clock):
                self.persistence.save(self.store, self.log, self.agent.clock, raise_errors=False)
            # Inject the live DB into the authority store so it can persist accounts
            authority_store.set_database(self.persistence.db)


    async def startup(self) -> None:
        if self.persistence:
            await asyncio.to_thread(self._startup_sync)

    async def shutdown(self) -> None:
        if self.persistence:
            await asyncio.to_thread(self.persistence.close)


def build_container(settings: Settings = None, client=None) -> Container:
    s = settings or get_settings()
    route, prio, clock = RouteService(s), PriorityService(s), SimClock()
    store, log, ws = StateStore(s), EventLog(), ConnectionManager()
    assessor = IncidentAssessmentAgent(s)
    allocator = ResourceAllocationAgent(s, route, prio, ResourceOptimizer(s, route))
    persistence = MongoPersistence(client or mongo.create_client(s), s.mongodb_db)
    agent = CommandPlanningAgent(store, log, ws, assessor, allocator, clock, s, persistence)
    return Container(s, store, log, ws, assessor, allocator, agent, persistence)


container = build_container()
