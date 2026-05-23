# Database & ORM

The SQLAlchemy 2.0 layer — engine, session, models, conventions, and the migration story. This is the *implementation* side of [03-storage.md](./03-storage.md).

## Package layout

```
backend/sace/db/
├── __init__.py        # exports get_session, init_db
├── base.py            # the DeclarativeBase
├── models.py          # TreeRow, NodeRow  (more to come)
├── session.py         # engine + sessionmaker + get_session generator
└── seed.py            # seed_from_json_directory()
```

Two rules for this package:

1. **`db/` knows about Pydantic; the rest of the code does not know about SQLAlchemy.** Translation lives in `store/tree_store.py`. Routers, prompt builders, and the agent take/return Pydantic `Node`/`Tree`.
2. **Models do not import anything from `api/` or `agent/`.** The `db/` layer is a leaf — `schema/`, `store/`, `api/`, and `agent/` may depend on it, never the reverse.

## The base

```python
# backend/sace/db/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

Plain SQLAlchemy 2.0. Every ORM model subclasses `Base`. No mixins yet (timestamps and ids are explicit per-model — there are few enough models that mixin overhead isn't worth it).

## Current models

```python
# backend/sace/db/models.py
class TreeRow(Base):
    __tablename__ = "trees"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    nodes: Mapped[list["NodeRow"]] = relationship(
        back_populates="tree",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class NodeRow(Base):
    __tablename__ = "nodes"

    tree_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("trees.id", ondelete="CASCADE"), primary_key=True,
    )
    id: Mapped[str] = mapped_column(String(256), primary_key=True)
    parent_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(String(280), nullable=False)
    detail: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tags_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    tree: Mapped[TreeRow] = relationship(back_populates="nodes")
```

### Design choices, with the reasoning

- **Composite primary key `(tree_id, id)`.** Trees own their nodes; a node id is only meaningful inside one tree. The composite PK encodes that. It also keeps queries scoped: every `WHERE tree_id = ?` clause is index-friendly because it leads the PK.
- **Adjacency list (`parent_id`), not nested set or materialized path.** We have small trees and rebuild the recursion in Python. Nested set models speed up "ancestors of X" queries we don't need; the cost in write complexity isn't worth it.
- **`sort_order` to preserve sibling order.** Author-order is semantically meaningful (the prompt renderer emits children in that order). Without `sort_order`, a `SELECT` without `ORDER BY` could shuffle them.
- **`tags_json` as `TEXT`.** SQLite has no array type and tags are an optional UX field. Postgres native arrays would be nicer; we will switch later only if tag queries become a thing.
- **`String(80)`/`String(280)`** mirror the Pydantic `max_length` caps. Schema enforcement at the DB layer too — a thicker safety net.
- **`ON DELETE CASCADE` + `passive_deletes=True` + ORM `cascade="all, delete-orphan"`.** Deleting a tree wipes its nodes in one statement at the DB level *and* SQLAlchemy stays consistent with the in-session state. Belt and suspenders are correct here.

### Indexes

The composite PK already gives us:
- O(log N) lookup on `(tree_id, id)` (used by `find_node`).
- O(log N) prefix lookup on `tree_id` alone (used by `_load_nodes`).

We do **not** index `parent_id` yet — `_children_map` builds the parent→children dict in Python from a single `SELECT * WHERE tree_id = ?`. If trees grow large enough that the in-memory grouping hurts, a `(tree_id, parent_id)` covering index is the right next step.

## The engine and session

```python
# backend/sace/db/session.py (the important bits)
_engine = None
_SessionLocal = None

def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        url = _resolve_database_url(get_settings().database_url)
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        _engine = create_engine(url, connect_args=connect_args)
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine

def get_session():
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
```

Choices that matter:

- **Lazy engine.** First access (lifespan boot or first request) creates it. Keeps tests cheap to spin up and tear down.
- **`check_same_thread=False`** for SQLite. FastAPI shares the engine across threads; the per-session boundary is request-scoped, so this is safe.
- **`autoflush=False`.** We commit explicitly; we don't want a stray `session.query(...)` to silently flush pending writes.
- **`autocommit=False`.** Same reason — every write goes through `session.commit()`.
- **Generator-based dep.** `get_session()` is a generator so FastAPI's `Depends` can run the `finally` block on response. No middleware needed.
- **Path resolution helper.** `_resolve_database_url` turns `sqlite:///./data/sace.db` (relative) into an absolute path under the repo root, and `mkdir(parents=True, exist_ok=True)` on the parent dir. Lets you clone the repo and `make dev-backend` without manually creating folders.

## init_db()

```python
def init_db() -> None:
    Base.metadata.create_all(get_engine())
```

Called from FastAPI's `lifespan`. Idempotent — `CREATE TABLE IF NOT EXISTS` semantics. **This is the only schema migration mechanism we have today.**

For v1 (trees + nodes), that's fine: the schema is set; we don't ship breaking changes mid-experiment. But as soon as we add Conversation/Message/Run tables (or change a column type), `create_all` will not migrate existing data. The next step then is Alembic — see the migration section.

## Seed flow

```python
# backend/sace/db/seed.py
def seed_from_json_directory(session: Session, directory: Path) -> int:
    if not directory.is_dir():
        return 0
    store = TreeStore(session)
    count = 0
    for path in sorted(directory.glob("*.json")):
        try:
            tree = Tree.model_validate(json.loads(path.read_text(encoding="utf-8")))
            if store.get(tree.id) is None:
                store.create(tree)
                count += 1
        except Exception:
            logger.exception("Failed to seed tree from %s", path)
    return count
```

Two safety properties:
- **Skip if exists.** Boot-time seed only fills empty rows. We never silently overwrite trees the user has edited via the API.
- **Don't crash.** A malformed JSON file is logged and skipped. The server still boots with the good trees.

To force a re-seed: delete `data/sace.db`, restart the server. Or call `store.update(...)` from a script — both work.

## Migrations — plan, not action

We are not running Alembic yet. The reason is simple: until we add new tables (Conversation/Message/Run), `Base.metadata.create_all` plus "delete `data/sace.db` to reset" is enough. Adding Alembic now is overhead without benefit.

When we add the conversation tables:

1. `uv add alembic`.
2. `alembic init backend/sace/db/migrations` — generate the layout.
3. Configure `target_metadata = Base.metadata` and the env to read `SACE_DATABASE_URL`.
4. Stop calling `init_db()` in lifespan; replace with `alembic upgrade head`.
5. First migration: the current tree/node schema as the baseline.
6. Subsequent migrations: each new table or column gets its own.

We commit to that path *the moment* the first new table lands. Doing it sooner is premature.

## Database URL → which database you get

`SACE_DATABASE_URL` is the single switch:

| Value | Behavior |
|---|---|
| `sqlite:///./data/sace.db` (default) | SQLite file under `data/`, auto-created |
| `sqlite:///:memory:` | Ephemeral, useful for tests |
| `postgresql+psycopg://user:pw@host/db` | Postgres |
| Supabase connection string | Postgres on Supabase (use the connection string Supabase prints) |

No other code paths change between these. The `connect_args` branch only matters for SQLite.

## Supabase — wired but not active

`supabase/config.toml` lives at the repo root. The intent: `supabase start` brings up a local Postgres + Studio + the rest, and you point `SACE_DATABASE_URL` at it. We do **not** use any Supabase-specific feature (auth, storage, realtime, RLS) — only Postgres. The config is there so the team can flip the switch when they want to.

We avoid coupling to Supabase APIs deliberately — we want the option to swap to plain Postgres at any time.

## Testing pattern

A test session points at `sqlite:///:memory:`. The pattern (to be added in `conftest.py` as we grow tests):

```python
@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()

@pytest.fixture
def tree_store(db_session):
    return TreeStore(db_session)
```

Tests get fresh schemas every time. No shared state between tests. The trade-off (slower than reusing a session) is acceptable at our scale.

## What we deliberately did not do

- **No `id` autoincrement / surrogate keys.** Domain ids (`cs`, `cs.languages.python`) are stable and human-readable. Adding an integer surrogate would be ceremony.
- **No `Base.registry` hacks for cross-module models.** Models live in one file. When it grows, we split by concern (e.g. `models/conversation.py`).
- **No async SQLAlchemy.** Our queries are tiny and fast; sync is simpler and the request handler is already async-friendly (FastAPI runs sync deps in a threadpool). The cost of going `async` would be every test fixture and every store call doubling in complexity for no measurable gain. Revisit if we hit hot-path latency from DB calls — we won't.
- **No `Repository` abstraction layer above the ORM.** `TreeStore` IS the abstraction. One layer of indirection, not two.
- **No `dataclasses` to mirror rows.** Rows talk to Pydantic via `TreeStore`'s translators. Adding a third shape (dataclass) would be a useless waypoint.

## When to break each of those rules

| Rule | Break when |
|---|---|
| No autoincrement | We start needing ULIDs for messages/runs (we will) — but those get string ULIDs, not ints |
| One models file | The file exceeds ~500 lines or three domains coexist awkwardly |
| Sync only | A single DB call regularly takes > 50 ms in prod |
| One repository per domain | A second consumer of `TreeStore` needs a subtly different view |

Document the trigger in a commit message when you do.
