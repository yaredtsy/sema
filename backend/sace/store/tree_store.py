from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from sace.db.models import NodeRow, TreeRow
from sace.schema.api import TreeSummary
from sace.schema.node import Node, Tree


class TreeNotFoundError(Exception):
    def __init__(self, tree_id: str) -> None:
        super().__init__(f"Tree {tree_id!r} not found")
        self.tree_id = tree_id


class TreeStore:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_summaries(self) -> list[TreeSummary]:
        rows = self._session.scalars(select(TreeRow).order_by(TreeRow.name)).all()
        summaries: list[TreeSummary] = []
        for row in rows:
            node_count = len(
                self._session.scalars(
                    select(NodeRow.id).where(NodeRow.tree_id == row.id)
                ).all()
            )
            summaries.append(
                TreeSummary(
                    id=row.id,
                    name=row.name,
                    description=row.description,
                    node_count=node_count,
                )
            )
        return summaries

    def get(self, tree_id: str) -> Tree | None:
        row = self._session.get(TreeRow, tree_id)
        if row is None:
            return None
        return _tree_from_rows(row, self._load_nodes(tree_id))

    def create(self, tree: Tree) -> Tree:
        if self._session.get(TreeRow, tree.id) is not None:
            raise ValueError(f"Tree {tree.id!r} already exists")
        now = datetime.now(UTC)
        self._session.add(
            TreeRow(
                id=tree.id,
                name=tree.name,
                description=tree.description,
                created_at=now,
                updated_at=now,
            )
        )
        self._replace_nodes(tree.id, tree.root)
        self._session.commit()
        return self.get(tree.id)  # type: ignore[return-value]

    def update(self, tree_id: str, tree: Tree) -> Tree:
        row = self._session.get(TreeRow, tree_id)
        if row is None:
            raise TreeNotFoundError(tree_id)
        row.name = tree.name
        row.description = tree.description
        row.updated_at = datetime.now(UTC)
        self._replace_nodes(tree_id, tree.root)
        self._session.commit()
        return self.get(tree_id)  # type: ignore[return-value]

    def delete(self, tree_id: str) -> None:
        row = self._session.get(TreeRow, tree_id)
        if row is None:
            raise TreeNotFoundError(tree_id)
        self._session.delete(row)
        self._session.commit()

    def find_node(self, tree_id: str, node_id: str) -> Node | None:
        row = self._session.get(NodeRow, (tree_id, node_id))
        if row is None:
            return None
        return _node_from_row(row, self._children_map(tree_id))

    def breadcrumbs(self, tree_id: str, node_id: str) -> list[Node]:
        nodes_by_id = {n.id: n for n in self._load_nodes(tree_id)}
        if node_id not in nodes_by_id:
            return []
        parent_map = self._parent_map(tree_id)
        path_ids: list[str] = []
        current: str | None = node_id
        while current is not None:
            path_ids.append(current)
            current = parent_map.get(current)
        path_ids.reverse()
        return [nodes_by_id[nid] for nid in path_ids]

    def _load_nodes(self, tree_id: str) -> list[NodeRow]:
        return list(
            self._session.scalars(
                select(NodeRow)
                .where(NodeRow.tree_id == tree_id)
                .order_by(NodeRow.sort_order, NodeRow.id)
            ).all()
        )

    def _parent_map(self, tree_id: str) -> dict[str, str | None]:
        rows = self._load_nodes(tree_id)
        return {r.id: r.parent_id for r in rows}

    def _children_map(self, tree_id: str) -> dict[str | None, list[NodeRow]]:
        rows = self._load_nodes(tree_id)
        children: dict[str | None, list[NodeRow]] = {}
        for row in rows:
            children.setdefault(row.parent_id, []).append(row)
        for key in children:
            children[key].sort(key=lambda r: (r.sort_order, r.id))
        return children

    def _replace_nodes(self, tree_id: str, root: Node) -> None:
        self._session.execute(delete(NodeRow).where(NodeRow.tree_id == tree_id))
        flat: list[tuple[Node, str | None, int]] = []

        def walk(node: Node, parent_id: str | None, sort_order: int) -> None:
            flat.append((node, parent_id, sort_order))
            for idx, child in enumerate(node.children):
                walk(child, node.id, idx)

        walk(root, None, 0)
        ids_seen: set[str] = set()
        for node, parent_id, sort_order in flat:
            if node.id in ids_seen:
                raise ValueError(f"Duplicate node id {node.id!r} in tree {tree_id!r}")
            ids_seen.add(node.id)
            self._session.add(
                NodeRow(
                    tree_id=tree_id,
                    id=node.id,
                    parent_id=parent_id,
                    title=node.title,
                    description=node.description,
                    detail=node.detail,
                    tags_json=json.dumps(node.tags),
                    sort_order=sort_order,
                )
            )


def _node_from_row(row: NodeRow, children_map: dict[str | None, list[NodeRow]]) -> Node:
    child_rows = children_map.get(row.id, [])
    return Node(
        id=row.id,
        title=row.title,
        description=row.description,
        detail=row.detail,
        children=[_node_from_row(c, children_map) for c in child_rows],
        tags=json.loads(row.tags_json or "[]"),
    )


def _tree_from_rows(tree_row: TreeRow, node_rows: list[NodeRow]) -> Tree:
    if not node_rows:
        raise ValueError(f"Tree {tree_row.id!r} has no nodes")
    children_map: dict[str | None, list[NodeRow]] = {}
    for row in node_rows:
        children_map.setdefault(row.parent_id, []).append(row)
    for key in children_map:
        children_map[key].sort(key=lambda r: (r.sort_order, r.id))
    roots = children_map.get(None, [])
    if len(roots) != 1:
        raise ValueError(f"Tree {tree_row.id!r} must have exactly one root node")
    root = _node_from_row(roots[0], children_map)
    return Tree(
        id=tree_row.id,
        name=tree_row.name,
        description=tree_row.description,
        root=root,
    )


def _find_in_node(node: Node, node_id: str) -> Node | None:
    if node.id == node_id:
        return node
    for child in node.children:
        found = _find_in_node(child, node_id)
        if found is not None:
            return found
    return None
