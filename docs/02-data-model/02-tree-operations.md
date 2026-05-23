# Tree operations

Read-only operations the rest of the system uses. They live in `backend/sace/store/tree_store.py`. The store is in-memory and immutable per process — we reload from disk if a tree changes.

## TreeStore API

```python
class TreeStore:
    def load(self, path: Path) -> None: ...
    def list_trees(self) -> list[TreeSummary]: ...
    def get_tree(self, tree_id: str) -> Tree: ...
    def get_node(self, tree_id: str, node_id: str) -> Node: ...
    def get_children(self, tree_id: str, node_id: str) -> list[Node]: ...
    def get_breadcrumbs(self, tree_id: str, node_id: str) -> list[Node]: ...
    def get_subtree_summary(self, tree_id: str, node_id: str, max_depth: int = 1) -> Node: ...
```

All getters raise `NodeNotFound` / `TreeNotFound` (custom exceptions in `schema/errors.py`).

## Indexing

On `load()` we build:

```python
self._trees: dict[str, Tree]                       # tree_id → Tree
self._index: dict[str, dict[str, Node]]            # tree_id → (node_id → Node)
self._parents: dict[str, dict[str, str | None]]    # tree_id → (node_id → parent_id)
```

`_index` lets us go from `node_id` → `Node` in O(1). `_parents` lets us compute breadcrumbs and validates uniqueness.

The index is built by a single DFS at load time. We **fail closed** on duplicate ids: a tree with two nodes sharing an id refuses to load. Same for cycles (which shouldn't be possible in a tree but we check anyway).

## Breadcrumbs

`get_breadcrumbs("cs", "cs.languages.python.async")` returns:

```
[ Node("cs"), Node("cs.languages"), Node("cs.languages.python"), Node("cs.languages.python.async") ]
```

Used by:
- The frontend, to render the path indicator.
- The routing prompt, to remind the LLM of the trail it has already taken (small breadcrumb summary, see [04-context-engineering/02-prompt-templates.md](../04-context-engineering/02-prompt-templates.md)).

## Subtree summary

`get_subtree_summary(tree_id, node_id, max_depth=1)` returns a *copy* of the subtree with `detail` stripped and children limited to `max_depth`. Used by the routing prompt — we want the children's titles + descriptions but never their `detail`.

The cheap implementation:

```python
def summarize(n: Node, depth_left: int) -> Node:
    return Node(
        id=n.id,
        title=n.title,
        description=n.description,
        detail="",                                     # always dropped
        children=[summarize(c, depth_left - 1) for c in n.children] if depth_left > 0 else [],
        tags=n.tags,
    )
```

## DFS / BFS helpers

We won't expose generic walkers in v1 — every consumer either (a) has a node id and looks it up, or (b) is the agent, which walks the tree one decision at a time. If a real need shows up later, add a `walk(predicate, order="dfs"|"bfs")` method.

## Mutability

There is **no** `add_node`, `update_node`, or `delete_node` in v1. Trees are JSON files. To change a tree:

1. Edit `data/trees/example.json`.
2. Re-run `make seed` (or hit a `/admin/reload` endpoint if we add one).

This trades convenience for simplicity. We avoid an entire class of "stale cache" bugs.

## Path = id?

We use **dotted ids** (`cs.languages.python`) as the canonical id form. We do *not* compute the id from the tree position — the JSON author writes it explicitly. This decouples the id from the tree structure: you can move a subtree without renaming everything inside it. The router only sees `id`, `title`, `description` — it doesn't care about the dots.

## Performance notes (v1)

- Trees are tiny (kilobytes). We never optimize.
- Loading does one full DFS — O(N) where N is node count.
- Lookups are O(1) hash.
- We do not lazy-load anything.

If we ever break out of "fits in memory", the right next step is SQLite with an adjacency-list table, not a graph DB. The `Node` schema is already SQLite-friendly.
