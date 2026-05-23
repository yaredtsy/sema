# Tree operations

The read-and-write surface for trees and nodes. Lives in `backend/sace/store/tree_store.py`. The store is **session-bound** — every `TreeStore` instance wraps a SQLAlchemy `Session` and is request-scoped via FastAPI's `Depends`.

## Why session-bound

The old design was a process-wide in-memory store. With SQLAlchemy in place, the simpler and more correct shape is:

- One `Session` per HTTP request (dependency-injected).
- `TreeStore(session)` is a thin façade over that session.
- The session is closed in a `finally` block by the dependency generator.

This gives us per-request transactional boundaries without exposing SQLAlchemy details to callers.

## TreeStore API

```python
class TreeStore:
    def __init__(self, session: Session) -> None: ...

    # Reads
    def list_summaries(self) -> list[TreeSummary]: ...
    def get(self, tree_id: str) -> Tree | None: ...
    def find_node(self, tree_id: str, node_id: str) -> Node | None: ...
    def breadcrumbs(self, tree_id: str, node_id: str) -> list[Node]: ...

    # Writes (each does its own commit)
    def create(self, tree: Tree) -> Tree: ...
    def update(self, tree_id: str, tree: Tree) -> Tree: ...
    def delete(self, tree_id: str) -> None: ...
```

Method-level semantics:

| Method | Returns | On miss | Commits? |
|---|---|---|---|
| `list_summaries` | `[]` if no trees | — | No |
| `get` | `None` | — | No |
| `find_node` | `None` | — | No |
| `breadcrumbs` | `[]` | — | No |
| `create` | the persisted `Tree` | `ValueError` if id collides | Yes |
| `update` | the persisted `Tree` | `TreeNotFoundError` | Yes |
| `delete` | `None` | `TreeNotFoundError` | Yes |

The **reads return `None` / `[]` rather than raising** — callers (FastAPI routes) decide whether a miss is a 404 or just empty state.

## Dependency injection

```python
# backend/sace/api/deps.py
def get_tree_store(session: Session = Depends(get_session)) -> TreeStore:
    return TreeStore(session)

# backend/sace/api/routes/trees.py
@router.get("/{tree_id}", response_model=Tree)
def get_tree(tree_id: str, store: TreeStore = Depends(get_tree_store)) -> Tree:
    tree = store.get(tree_id)
    if tree is None:
        raise HTTPException(status_code=404, ...)
    return tree
```

The session is closed when the request finishes. No long-lived state.

## How the recursive Pydantic ↔ flat rows round-trip works

Given a `Tree` with a recursive `Node` root, we flatten it to rows and reconstruct it on read.

### Flatten (on `create` / `update`)

```python
def walk(node: Node, parent_id: str | None, sort_order: int) -> None:
    flat.append((node, parent_id, sort_order))
    for idx, child in enumerate(node.children):
        walk(child, node.id, idx)
```

- DFS in author-order; `sort_order` captures sibling position.
- `parent_id is None` for the root.
- Duplicate ids within one tree raise `ValueError`.
- An `update` wipes the old rows for that tree (`DELETE FROM nodes WHERE tree_id = ?`) and re-inserts. Simpler than diffing, and trees are small.

### Reconstruct (on `get` / `find_node` / `breadcrumbs`)

```python
def _children_map(tree_id) -> dict[str | None, list[NodeRow]]:
    rows = self._load_nodes(tree_id)
    children = {}
    for row in rows:
        children.setdefault(row.parent_id, []).append(row)
    for key in children:
        children[key].sort(key=lambda r: (r.sort_order, r.id))
    return children
```

- One query per tree (`SELECT * FROM nodes WHERE tree_id = ?`).
- Group by `parent_id`; sort children by `(sort_order, id)`.
- DFS from the unique row with `parent_id IS NULL` rebuilds the `Node` recursion.

The cost is O(N) per read where N is nodes in the tree. For our target tree size (≤ 500 nodes) this is well under a millisecond.

## Breadcrumbs

`breadcrumbs("cs", "cs.languages.python.async")` walks parent pointers:

```
[ Node("cs"), Node("cs.languages"), Node("cs.languages.python"), Node("cs.languages.python.async") ]
```

Used by:
- The frontend tree-overlay debug view, to render the path of the cursor.
- The routing prompt, to remind the LLM of the trail it has taken (a compact `<breadcrumbs>` block — see [04-context-engineering/01-xml-tree-format.md](../04-context-engineering/01-xml-tree-format.md)).

Implementation walks `parent_map` until `None`, then reverses.

## Subtree summary (router-prompt helper)

The router-prompt builder needs *one level* of children at a time, **without** the `detail` field. It calls `find_node()` for the cursor, reads `cursor.children` (already populated), and projects each child into the prompt's XML representation. We do not stream `detail` for non-cursor nodes — the renderer always drops it.

(There is no separate `get_subtree_summary` method anymore; the renderer in `prompts/render_xml.py` handles the projection. Same effect, fewer indirections.)

## Concurrency and transactions

- Each HTTP request gets its own `Session`.
- `autocommit=False`, `autoflush=False` — explicit commits only.
- Writes (`create`, `update`, `delete`) commit at the end of the method.
- Reads don't commit; the session is closed when the request finishes.
- We do not hold cross-request transactions.

In SQLite this means a single writer at a time but plenty of concurrent readers. In Postgres, writers don't block other writers on disjoint rows. For our workload this is plenty.

## Errors

| Class | Raised by | Caught at the route layer as |
|---|---|---|
| `TreeNotFoundError(tree_id)` | `update`, `delete` | `HTTPException(404)` |
| `ValueError("Tree X already exists")` | `create` on id collision | `HTTPException(409)` |
| `ValueError("Duplicate node id ... in tree ...")` | `create`, `update` flatten step | `HTTPException(400)` |
| `pydantic.ValidationError` | Pydantic at body-parse time | FastAPI's default 422 |

The store never returns "partial" success. If a write raises mid-way, the session is rolled back when it's closed (SQLAlchemy default).

## What is NOT in the store

| Not here | Where it lives |
|---|---|
| LLM calls | `backend/sace/llm/` |
| Prompt rendering | `backend/sace/prompts/` |
| Agent state, runs | `backend/sace/agent/` + (future) `backend/sace/db/` conversation tables |
| Events / SSE bus | `backend/sace/events/` |
| HTTP routing | `backend/sace/api/` |

The store is *just* trees. Single responsibility.

## What was removed from the older design

The previous design had `TreeStore.from_dir(path)` (a class method that loaded JSON into an in-memory dict). That no longer exists. Trees are loaded into the DB once at lifespan boot (see [03-storage.md](./03-storage.md)) and read from the DB thereafter.

The previous `get_subtree_summary` method also went away — the prompt renderer projects directly from the recursive `Node`.

If you are reading older commits, the prior interface looked like:

```python
TreeStore.from_dir(path)            # gone — boot-time seed instead
store.get_tree(id)                  # → store.get(id)
store.get_children(tree_id, id)     # → reach into the node returned by find_node
store.get_subtree_summary(...)      # → renderer responsibility now
```

The current API is shorter and stricter.
