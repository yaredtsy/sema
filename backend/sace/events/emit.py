from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sace.events.bus import EventBus
from sace.schema.events import EventEnvelope


async def emit_event(
    bus: EventBus,
    run_id: str,
    event: EventEnvelope,
    *,
    seq: int,
) -> None:
    payload: dict[str, Any] = event.model_dump()
    payload.setdefault("ts", datetime.now(timezone.utc).isoformat())
    payload["seq"] = seq
    payload["run_id"] = run_id
    await bus.publish(run_id, payload)
