#!/usr/bin/env python3
"""Export a run trace to JSON (stub)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a run trace")
    parser.add_argument("run_id", help="Run id to export")
    parser.add_argument("-o", "--output", type=Path, help="Output file path")
    args = parser.parse_args()
    payload = {"run_id": args.run_id, "status": "not_implemented"}
    text = json.dumps(payload, indent=2)
    if args.output:
        args.output.write_text(text)
        print(f"Wrote {args.output}")
    else:
        print(text)


if __name__ == "__main__":
    main()
