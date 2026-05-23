from __future__ import annotations

import logging

from sace.config import get_settings


def setup_logging() -> None:
    level = getattr(logging, get_settings().sace_log_level.upper(), logging.INFO)
    logging.basicConfig(level=level, format="%(levelname)s %(name)s %(message)s")
