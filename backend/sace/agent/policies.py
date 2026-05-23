from __future__ import annotations

from sace.config import get_settings


def max_depth_reached(depth: int) -> bool:
    return depth >= get_settings().sace_max_depth


def should_stop(*, depth: int, has_answer: bool) -> bool:
    if has_answer:
        return True
    return max_depth_reached(depth)
