#!/usr/bin/env python3
"""Load data/trees/*.json into the SQLite database."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from sace.db.seed import seed_from_json_directory  # noqa: E402
from sace.db.session import get_session_factory, init_db  # noqa: E402


def main() -> None:
    init_db()
    data_dir = ROOT / "data" / "trees"
    session = get_session_factory()()
    try:
        count = seed_from_json_directory(session, data_dir)
        print(f"Seeded {count} tree(s) from {data_dir}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
