"""Minimal in-memory stand-in for the slice of the pymongo API that db/mongo.py uses.

Deliberately strict so tests catch things a real MongoDB would reject or change:
* only BSON-encodable types are accepted (no Enum instances, no tuples, no dotted/`$` keys),
* datetimes come back UTC-aware and truncated to milliseconds, exactly like pymongo with tz_aware=True,
* writes/ping can be made to fail to simulate an outage.
"""
import copy
from datetime import datetime, timezone

_SCALARS = (str, int, float, bool, type(None))


def bsonify(v, path="doc"):
    t = type(v)
    if t in _SCALARS:
        return v
    if t is datetime:
        v = (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        return v.replace(microsecond=v.microsecond // 1000 * 1000)
    if t is dict:
        out = {}
        for k, x in v.items():
            if type(k) is not str or "." in k or k.startswith("$"):
                raise TypeError(f"invalid BSON key {k!r} at {path}")
            out[k] = bsonify(x, f"{path}.{k}")
        return out
    if t is list:
        return [bsonify(x, f"{path}[]") for x in v]
    raise TypeError(f"{t.__name__} is not BSON-encodable (at {path})")


class FakeCollection:
    def __init__(self, client):
        self._client, self.docs = client, {}

    def _check_writable(self):
        if self._client.fail_writes:
            raise ConnectionError("simulated MongoDB outage")

    def create_index(self, *args, **kwargs):
        self._check_writable()
        return "index"

    def replace_one(self, flt, doc, upsert=False):
        self._check_writable()
        if flt["_id"] not in self.docs and not upsert:
            return
        self.docs[flt["_id"]] = bsonify(doc)

    def delete_many(self, flt):
        self._check_writable()
        assert flt == {}, "fake only supports delete_many({})"
        self.docs.clear()

    def find_one(self, flt):
        return copy.deepcopy(self.docs.get(flt["_id"]))

    def find(self, flt=None):
        assert not flt, "fake only supports find({})"
        return [copy.deepcopy(d) for d in self.docs.values()]


class FakeDatabase:
    def __init__(self, client):
        self._client, self._cols = client, {}

    def __getitem__(self, name):
        return self._cols.setdefault(name, FakeCollection(self._client))


class _Admin:
    def __init__(self, client):
        self._client = client

    def command(self, name):
        if self._client.fail_ping:
            raise ConnectionError("simulated MongoDB unreachable")
        assert name == "ping"
        return {"ok": 1}


class FakeMongoClient:
    def __init__(self):
        self._dbs, self.fail_writes, self.fail_ping = {}, False, False
        self.admin, self.closed = _Admin(self), False

    def __getitem__(self, name):
        return self._dbs.setdefault(name, FakeDatabase(self))

    def close(self):
        self.closed = True
