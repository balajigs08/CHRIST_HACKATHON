"""MongoDB persistence for CRISIS COMMAND.

Design: the in-memory ``StateStore`` / ``EventLog`` stay the *working set* used by the agents (all mutations are
already serialised by the command agent's lock). MongoDB is the system of record:

* on startup the working set is restored from MongoDB (``restore``);
* at the end of every operation only what changed is written back (``save``).

Collections: incidents, resources, approvals, plans, plan_history, events, meta.
Every document uses the domain id as ``_id`` (INC001, A01, APR001, PLN003, EVT0042 ...).
"""
import copy
import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

from models.schemas import Approval, Event, Incident, PlanHistoryEntry, Resource, ResponsePlan

log = logging.getLogger("crisis-command.db")

COLLECTIONS = ("incidents", "resources", "approvals", "plans", "plan_history", "events", "meta")
META_ID = "state"
SCHEMA_VERSION = 1


def create_client(settings):
    """Build a MongoClient (lazy: no network I/O until first use). ``tz_aware`` keeps datetimes UTC-aware."""
    try:
        from pymongo import MongoClient
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pymongo is not installed. Run: pip install -r requirements.txt") from exc
    return MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=settings.mongodb_timeout_ms, tz_aware=True)


# ---------------------------------------------------------------- (de)serialisation
def _plain(v: Any) -> Any:
    """Pydantic python-mode dump -> BSON-friendly values (enums become their plain value)."""
    if isinstance(v, Enum):
        return v.value
    if isinstance(v, dict):
        return {k: _plain(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_plain(x) for x in v]
    return v


def _aware(v: Any) -> Any:
    """Guarantee UTC-aware datetimes on the way back in (the app compares them with aware 'now')."""
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, dict):
        return {k: _aware(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_aware(x) for x in v]
    return v


def to_doc(model, key: str = "id", seq: Optional[int] = None) -> dict:
    d = _plain(model.model_dump(mode="python"))
    d["_id"] = d.pop(key)
    if seq is not None:
        d["_seq"] = seq
    return d


def from_doc(cls, doc: dict, key: str = "id"):
    d = _aware(dict(doc))
    d[key] = d.pop("_id")
    d.pop("_seq", None)
    return cls.model_validate(d)


class MongoPersistence:
    def __init__(self, client, db_name: str):
        self.client = client
        self.db = client[db_name]
        self.db_name = db_name
        self._written: dict[str, dict[str, dict]] = {}  # last successfully written doc per collection/id
        self._n_history = 0   # plan_history entries already persisted (append-only)
        self._n_events = 0    # events already persisted (append-only)
        self._wipe = False    # a scenario reset is waiting to be applied to the database
        self.healthy = True
        self.last_error: Optional[str] = None

    # ------------------------------------------------------------ lifecycle
    def connect(self) -> None:
        """Check connection to MongoDB, ping database, and ensure collection indexes exist."""
        try:
            self.client.admin.command("ping")
            self.db["events"].create_index([("timestamp", 1)])
            self.db["incidents"].create_index([("status", 1)])
            self.db["approvals"].create_index([("status", 1)])
            self.healthy = True
            self.last_error = None
            log.info("Successfully connected to MongoDB database '%s'", self.db_name)
        except Exception as exc:
            self.healthy = False
            self.last_error = f"{type(exc).__name__}: {exc}"
            log.warning("MongoDB connection ping failed: %s", exc)


    def close(self) -> None:
        self.client.close()

    def status(self) -> dict:
        try:
            self.client.admin.command("ping")
            self.healthy = True
            self.last_error = None
        except Exception as exc:
            self.healthy = False
            self.last_error = f"{type(exc).__name__}: {exc}"
        return {
            "backend": "mongodb",
            "database": self.db_name,
            "status": "connected" if self.healthy else "disconnected",
            "last_error": self.last_error,
        }


    def mark_reset(self) -> None:
        """Called after a scenario reset: the next save wipes the collections before writing."""
        self._wipe = True

    # ------------------------------------------------------------ restore
    def restore(self, store, event_log, clock) -> bool:
        """Load persisted state into the in-memory working set. Returns False on an empty (new) database."""
        meta = self.db["meta"].find_one({"_id": META_ID})
        if meta is None:
            return False
        ordered = lambda name: sorted(self.db[name].find({}), key=lambda d: d.get("_seq", 0))
        store.incidents = {d["_id"]: from_doc(Incident, d) for d in self.db["incidents"].find({})}
        store.resources = {d["_id"]: from_doc(Resource, d) for d in self.db["resources"].find({})}
        store.approvals = {d["_id"]: from_doc(Approval, d) for d in ordered("approvals")}
        store.plan_history = [from_doc(PlanHistoryEntry, d, "plan_id") for d in ordered("plan_history")]
        plan_doc = self.db["plans"].find_one({"_id": meta.get("current_plan_id")})
        if plan_doc is not None:
            store.current_plan = from_doc(ResponsePlan, plan_doc, "plan_id")
            store.assignments = list(store.current_plan.assignments)
        store.acknowledged = {a["signature"]: a["approval_id"] for a in meta.get("acknowledged", [])}
        store.load_counters(meta.get("counters", {}))
        event_log.restore([from_doc(Event, d) for d in ordered("events")], meta.get("event_counter", 0))
        clock.offset = timedelta(seconds=meta.get("clock_offset_seconds", 0.0))
        self._written.clear()
        self._n_history, self._n_events = len(store.plan_history), len(event_log.events)
        self._wipe = False
        log.info("Restored %d incidents, %d resources, %d events from MongoDB",
                 len(store.incidents), len(store.resources), len(event_log.events))
        return True

    # ------------------------------------------------------------ save
    def save(self, store, event_log, clock, raise_errors: bool = False) -> bool:
        """Write everything that changed since the last successful save. Never raises unless asked to:
        an outage must not stop dispatching; the next successful save catches up automatically."""
        try:
            self._save(store, event_log, clock)
        except Exception as exc:
            self.healthy, self.last_error = False, f"{type(exc).__name__}: {exc}"
            log.exception("MongoDB write failed; state is kept in memory and will be retried on the next operation")
            if raise_errors:
                raise
            return False
        self.healthy, self.last_error = True, None
        return True

    def _upsert(self, name: str, doc: dict) -> None:
        self.db[name].replace_one({"_id": doc["_id"]}, doc, upsert=True)

    def _sync(self, name: str, docs: list[dict]) -> None:
        """Upsert only documents that differ from what was last written."""
        seen = self._written.setdefault(name, {})
        for doc in docs:
            if seen.get(doc["_id"]) != doc:
                self._upsert(name, doc)
                seen[doc["_id"]] = copy.deepcopy(doc)

    def _save(self, store, event_log, clock) -> None:
        if self._wipe:
            for name in COLLECTIONS:
                self.db[name].delete_many({})
            self._written.clear()
            self._n_history = self._n_events = 0
            self._wipe = False

        self._sync("incidents", [to_doc(i) for i in store.incidents.values()])
        self._sync("resources", [to_doc(r) for r in store.resources.values()])
        self._sync("approvals", [to_doc(a, seq=n) for n, a in enumerate(store.approvals.values())])
        if store.current_plan is not None:
            self._sync("plans", [to_doc(store.current_plan, "plan_id")])

        for n in range(self._n_history, len(store.plan_history)):  # append-only
            self._upsert("plan_history", to_doc(store.plan_history[n], "plan_id", seq=n))
            self._n_history = n + 1
        for n in range(self._n_events, len(event_log.events)):     # append-only
            self._upsert("events", to_doc(event_log.events[n], seq=n))
            self._n_events = n + 1

        self._upsert("meta", {
            "_id": META_ID, "schema_version": SCHEMA_VERSION,
            "counters": store.dump_counters(),
            "acknowledged": [{"signature": s, "approval_id": a} for s, a in store.acknowledged.items()],
            "event_counter": event_log.counter,
            "clock_offset_seconds": clock.offset.total_seconds(),
            "current_plan_id": store.current_plan.plan_id if store.current_plan else None,
            "updated_at": datetime.now(timezone.utc)})
