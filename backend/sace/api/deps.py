from __future__ import annotations

from functools import lru_cache

from fastapi import Depends
from sqlalchemy.orm import Session

from sace.api.runs import RunRegistry
from sace.db.session import get_session
from sace.events.bus import EventBus
from sace.store.tree_store import TreeStore


@lru_cache
def get_event_bus() -> EventBus:
    return EventBus()


@lru_cache
def get_run_registry() -> RunRegistry:
    return RunRegistry()


def get_tree_store(session: Session = Depends(get_session)) -> TreeStore:
    return TreeStore(session)
