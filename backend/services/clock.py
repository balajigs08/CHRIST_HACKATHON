from datetime import datetime, timedelta, timezone


class SimClock:
    """Wall clock plus a simulation offset so demos can jump forward (e.g. T+10 minutes)."""

    def __init__(self):
        self.offset = timedelta()

    def now(self) -> datetime:
        return datetime.now(timezone.utc) + self.offset

    def advance(self, minutes: float) -> None:
        self.offset += timedelta(minutes=minutes)

    def reset(self) -> None:
        self.offset = timedelta()
