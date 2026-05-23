# Phase 1 — Foundation

**Goal:** A working monorepo, the data model, and a seed tree. No agent yet. No frontend yet. The unit of progress is "I can load a tree and query a node from a Python REPL."

**Done when:** `uv run python -c "from sace.store import TreeStore; TreeStore.from_dir('data/trees').get_node('cs', 'cs.languages.python')"` returns the node.

## Tasks

### 1.1 Repo scaffolding
- Add `frontend/` and `backend/` directories (empty placeholders).
- Move existing `hello.py` content into `backend/sace/__init__.py` (or delete it).
- Update root `pyproject.toml` to declare the package as `backend/sace/`.
- Add `Makefile` with `dev`, `dev-backend`, `dev-frontend`, `test`, `seed`, `types`, `lint`, `fmt` (most stubs for now).

### 1.2 Pydantic schemas
- `backend/sace/schema/node.py` — `Node`, `Tree`
- `backend/sace/schema/api.py` — `TreeSummary`, `QueryRequest`, `QueryResponse`
- `backend/sace/schema/events.py` — placeholder
- `backend/sace/schema/state.py` — placeholder
- Validation rules per [02-data-model/01-node-schema.md](../02-data-model/01-node-schema.md): pattern for `id`, length caps.

### 1.3 TreeStore
- `backend/sace/store/json_loader.py` — read a single JSON file, validate via Pydantic.
- `backend/sace/store/tree_store.py` — `from_dir(path)`, `get_tree`, `get_node`, `get_children`, `get_breadcrumbs`, `get_subtree_summary`.
- Reject duplicate node ids at load.
- Custom exceptions `TreeNotFound`, `NodeNotFound`, `DuplicateNodeId`.

### 1.4 Seed tree
- `data/trees/cs.json` — a small but real CS-topic tree. Aim for depth 3–4, branching 3–5.
- `data/trees/README.md` — what each tree is for, authoring conventions.
- A second tiny tree (e.g. `cooking.json`) for testing tree-id selection logic.

### 1.5 Tests
- `tests/unit/test_node_schema.py` — pattern, length, extra-fields rejection.
- `tests/unit/test_tree_store.py` — load, lookup, breadcrumbs, duplicate detection.
- `conftest.py` — pytest fixtures for a small in-memory tree.

### 1.6 Tooling
- `ruff` config in `pyproject.toml` (line length 100, target 3.12).
- `mypy` config — `strict = true` for `sace/schema/` and `sace/store/`.
- Run `make lint` and `make test` cleanly.

## Out of scope for Phase 1

- LangGraph
- FastAPI server
- LLM access of any kind
- Frontend
- Hot reload, watchfiles

## Time estimate (rough)

A focused weekend. The longest piece is the seed tree — content takes longer than code.

## Risks / unknowns

- **Tree authoring is the bottleneck.** Plan to spend 60% of Phase 1 on the seed tree, not on Python.
- **Duplicate id validation requires a DFS we haven't written.** Trivial, but easy to forget; covered by a test.
