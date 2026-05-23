#!/usr/bin/env python3
"""Regenerate frontend/src/types/generated.ts from Pydantic schemas (stub)."""

from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "frontend" / "src" / "types" / "generated.ts"

STUB = """// Auto-generated from Pydantic — run `make types` to refresh.
// Do not edit by hand.

export interface Node {
  id: string;
  title: string;
  description: string;
  detail?: string;
  children?: Node[];
  tags?: string[];
}

export interface Tree {
  id: string;
  name: string;
  description?: string;
  root: Node;
}

export interface TreeSummary {
  id: string;
  name: string;
  description?: string;
}
"""


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(STUB)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
