from __future__ import annotations

import json
from pathlib import Path

from sace.schema.node import Tree


def load_tree_file(path: Path) -> Tree:
    data = json.loads(path.read_text(encoding="utf-8"))
    return Tree.model_validate(data)
