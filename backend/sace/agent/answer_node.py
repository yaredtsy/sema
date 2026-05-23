from __future__ import annotations

from typing import Any


def answer_node(state: dict[str, Any]) -> dict[str, Any]:
    """Produce final answer from trace (stub)."""
    state = dict(state)
    state.setdefault("final_answer", "")
    return state
