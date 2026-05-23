from __future__ import annotations

from typing import Any


class RunRegistry:
    """Track in-flight runs and cancellation (stub)."""

    def __init__(self) -> None:
        self._runs: dict[str, dict[str, Any]] = {}

    def register(self, run_id: str, meta: dict[str, Any] | None = None) -> None:
        self._runs[run_id] = meta or {}

    def get(self, run_id: str) -> dict[str, Any] | None:
        return self._runs.get(run_id)

    def cancel(self, run_id: str) -> bool:
        if run_id in self._runs:
            self._runs[run_id]["cancelled"] = True
            return True
        return False
