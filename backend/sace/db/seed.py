from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from sace.schema.node import Tree
from sace.store.tree_store import TreeStore

logger = logging.getLogger(__name__)


def seed_from_json_directory(session: Session, directory: Path) -> int:
    if not directory.is_dir():
        return 0
    store = TreeStore(session)
    count = 0
    for path in sorted(directory.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            tree = Tree.model_validate(data)
            if store.get(tree.id) is None:
                store.create(tree)
                count += 1
                logger.info("Seeded tree %s from %s", tree.id, path.name)
        except Exception:
            logger.exception("Failed to seed tree from %s", path)
    return count
