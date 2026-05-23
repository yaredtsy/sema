from __future__ import annotations

from pathlib import Path

from sace.store.tree_store import TreeStore

ROOT = Path(__file__).resolve().parents[3]
TREES = ROOT / "data" / "trees"


def test_load_from_directory(tree_store: TreeStore) -> None:
    count = tree_store.load_from_directory(TREES)
    assert count >= 1
    summaries = tree_store.list_summaries()
    assert any(s.id == "example-cs" for s in summaries)
