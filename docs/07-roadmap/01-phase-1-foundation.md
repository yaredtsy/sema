# Phase 1 — Foundation

**Goal:** A working monorepo, the data model, **a real persistence layer**, and a seed tree path. No agent yet. No frontend (beyond a placeholder) yet.

**Done when:** the FastAPI server starts; trees from `data/trees/*.json` are auto-seeded on cold boot into `data/sace.db`; `GET /api/v1/trees` returns the list; `GET /api/v1/trees/{id}` returns the full tree; the tree CRUD round-trips.

This phase is **largely complete** in the current repo. The checklist below shows status.

## Tasks

### 1.1 Repo scaffolding — ✅ done
- `backend/` and `frontend/` exist.
- Root `pyproject.toml` declares the `sace` package and the dev dependency group.
- `Makefile` with `dev-backend`, `dev-frontend`, `test`, `seed`, `types` targets.
- `.gitignore` covers `.venv/`, `node_modules/`, `data/*.db`, `.env*`.

### 1.2 Pydantic schemas — ✅ done
- `backend/sace/schema/node.py` — `Node`, `Tree` with id pattern + length caps + `extra="forbid"`.
- `backend/sace/schema/api.py` — `TreeSummary`, `TreeListResponse`, `NodeDetailResponse`, `QueryRequest`, `QueryResponse`.
- `backend/sace/schema/events.py` — placeholder (full shape coming in Phase 4).
- `backend/sace/schema/state.py` — placeholder.

### 1.3 SQLAlchemy persistence — ✅ done
- `backend/sace/db/base.py` — `DeclarativeBase`.
- `backend/sace/db/models.py` — `TreeRow`, `NodeRow` with composite PK `(tree_id, id)`, `parent_id` + `sort_order` adjacency list, `tags_json` TEXT, `ON DELETE CASCADE`.
- `backend/sace/db/session.py` — lazy engine, `sessionmaker`, `get_session()` generator, SQLite path resolver (relative URLs resolve to repo root, parent dirs auto-created), `check_same_thread=False` for SQLite, `autoflush=False`, `autocommit=False`.
- `backend/sace/db/seed.py` — `seed_from_json_directory()` skips trees that already exist; logs and skips bad files.
- See [02-data-model/05-database-and-orm.md](../02-data-model/05-database-and-orm.md) for the rationale.

### 1.4 TreeStore — ✅ done
- `backend/sace/store/tree_store.py` — session-bound: `list_summaries`, `get`, `find_node`, `breadcrumbs`, `create`, `update`, `delete`.
- Flatten/reconstruct between Pydantic `Node`/`Tree` and `(NodeRow, parent_id, sort_order)` rows.
- Rejects duplicate node ids within a tree.
- Updates do `DELETE ... WHERE tree_id = ? ; INSERT ...` atomically (simpler than diffing; trees are small).
- `backend/sace/store/json_loader.py` — one-shot `Tree.model_validate(json)` helper.

### 1.5 FastAPI app + dependency injection — ✅ done
- `backend/sace/api/app.py` — `create_app()` factory, CORS for `localhost:5173/5174` (and regex for any local dev port), lifespan that calls `init_db()` and seeds from `data/trees/` when the DB is cold.
- `backend/sace/api/deps.py` — `get_session` → `get_tree_store`, plus `get_event_bus` and `get_run_registry` placeholders for Phase 4.
- `backend/sace/api/routes/trees.py` — full CRUD: `GET`, `POST`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `GET /{id}/nodes/{node_id}`.
- `/api/v1/health` returns `{"status": "ok"}`.

### 1.6 Seed data — ✅ partially done
- `data/trees/example-cs.json` and `data/trees/example-cooking.json` exist.
- `data/trees/README.md` (authoring conventions) — **TODO** (covered in [02-data-model/03-storage.md](../02-data-model/03-storage.md)'s conventions section; copy in.)
- Conventions are documented; we should add at least one more tree with a sharper, narrower domain (e.g. a stdlib subsystem) once we start measuring routing accuracy.

### 1.7 Tests — 🚧 partial
- `tests/conftest.py` exists but its `tree_store` fixture currently does `TreeStore()` (no session) — **needs updating** to use an in-memory SQLite session per the pattern in [05-database-and-orm.md](../02-data-model/05-database-and-orm.md).
- `tests/unit/test_render_xml.py` exists (rendering tested independently of the store).
- `tests/unit/test_tree_store.py` exists — should grow to cover: round-trip create/get, update preserves sort_order, delete cascades nodes, breadcrumbs traverse correctly.
- `tests/integration/test_health.py` exists.
- **Missing:** an integration test that posts a tree via the API, gets it back, deletes it.

### 1.8 Tooling — ✅ done (minimal)
- `ruff` configured (`line-length = 100`, target `py312`, selecting `E`, `F`, `I`, `UP`).
- `pytest` configured (`asyncio_mode = "auto"`, testpaths = `backend/tests`).
- `mypy` strict config — not added yet; do when the type churn calms.

## Punch list to close Phase 1

In rough order of value:

1. **Fix the `tree_store` fixture** in `conftest.py` to provide a real in-memory SQLite session, so the store unit tests can be written and pass.
2. **Add `tests/integration/test_trees_crud.py`** that exercises POST → GET → PUT → DELETE through the FastAPI test client.
3. **Add `data/trees/README.md`** with the authoring conventions copied from [02-data-model/03-storage.md](../02-data-model/03-storage.md).
4. **Decide on the `/admin/reload` route** — currently planned in the API doc but not implemented. Optional; can also wait until trees start changing on disk during a session.

Everything else in Phase 1 is shipped.

## Out of scope (already deferred to later phases)

- LangGraph agent (Phase 2).
- LLM access (Phase 2).
- SSE events (Phase 4).
- Conversation/Message/Run tables + `ConversationManager` (Phase 3, with Alembic adopted at the same time).
- Frontend wiring (Phase 3+).

## Decisions that landed in this phase

- **SQLAlchemy 2.0** as the ORM (`DeclarativeBase`, `Mapped[T]`).
- **SQLite for dev**; `SACE_DATABASE_URL` switches to Postgres/Supabase with no code changes.
- **Adjacency list** (`parent_id` + `sort_order`) rather than nested set / materialized path. Simpler; trees are small.
- **Pydantic ↔ ORM translation lives in `TreeStore`.** No code outside `store/` and `db/` touches SQLAlchemy.
- **Boot-time seed only on cold DB.** Once you mutate via the API, JSON files are a backup, not a source.
- **No Alembic yet** — `create_all()` until the schema starts evolving. Trigger for adopting Alembic: when Conversation/Message/Run tables land.

## Time estimate (historical)

The DB layer plus tree CRUD shipped in roughly the time the original Phase 1 budget allowed for an in-memory store. The SQLAlchemy work paid for itself almost immediately by making the API surface honest (you can `PUT` a tree and it stays put).
