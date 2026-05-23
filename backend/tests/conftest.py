from __future__ import annotations

import pytest

from sace.store.tree_store import TreeStore


@pytest.fixture
def tree_store() -> TreeStore:
    return TreeStore()
