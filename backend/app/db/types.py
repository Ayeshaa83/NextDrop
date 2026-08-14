"""
Shared column types.

UTCDateTime fixes a bug that silently affects any non-UTC reader: every
DateTime column here stores naive values that are UTC by convention
(datetime.utcnow() in Python, func.now() against a GMT-configured DB
session) but carry no timezone marker. Read back naive and serialized to
JSON as-is, a browser parses "2026-08-14T11:18:09" as LOCAL time, not
UTC — for an IST reader that's a silent 5.5-hour shift in every "time
ago" display (confirmed: last_updated read back as ~330 minutes old
instead of ~7).

Aliasing this as `DateTime` in each model's import means every existing
`mapped_column(DateTime, ...)` picks it up with no per-column changes —
values come back from the DB already UTC-aware, so datetime.isoformat()
naturally includes '+00:00' everywhere, and no Pydantic schema needs its
own field_serializer to get this right.

TypeDecorator delegates DDL compilation to `impl`, so this changes no
database schema and needs no migration — it's purely how values are
translated between Python and the DB.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime as _DateTime
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    impl = _DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        # Written values are naive UTC everywhere in this codebase already
        # (datetime.utcnow()); only normalize if something aware slips in.
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value
