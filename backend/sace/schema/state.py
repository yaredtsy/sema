from __future__ import annotations

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    run_id: str
    tree_id: str
    query: str
    cursor: str | None
    trace: list[dict[str, Any]]
    final_answer: str | None
