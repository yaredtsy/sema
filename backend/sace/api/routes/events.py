from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from sace.api.deps import get_event_bus
from sace.events.bus import EventBus

router = APIRouter()


@router.get("/{run_id}")
async def stream_events(run_id: str, bus: EventBus = Depends(get_event_bus)):
    queue = bus.subscribe(run_id)

    async def event_generator():
        try:
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {
                        "event": payload.get("name", "message"),
                        "data": json.dumps(payload),
                    }
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "{}"}
        finally:
            bus.unsubscribe(run_id, queue)

    return EventSourceResponse(event_generator())
