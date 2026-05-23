from __future__ import annotations

import secrets


def new_run_id() -> str:
    """Generate a short run id (stub — not ULID yet)."""
    return secrets.token_hex(8)
