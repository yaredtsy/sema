from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any


class EventBus:
    """In-memory pub/sub keyed by run_id."""

    def __init__(self) -> None:
        self._queues: dict[str, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)

    def subscribe(self, run_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._queues[run_id].append(queue)
        return queue

    async def publish(self, run_id: str, event: dict[str, Any]) -> None:
        for queue in self._queues.get(run_id, []):
            await queue.put(event)

    def unsubscribe(self, run_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        subs = self._queues.get(run_id, [])
        if queue in subs:
            subs.remove(queue)
