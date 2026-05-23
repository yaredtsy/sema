# Storage

Trees live in a relational database, accessed via **SQLAlchemy 2.0**. JSON files are still the *authoring* and *import* format, but the runtime source of truth is the DB. This page covers the storage strategy; the ORM models, sessions, and migration story are in [05-database-and-orm.md](./05-database-and-orm.md).

## Strategy at a glance

| Layer | What |
|---|---|
| **Authoring / version control** | `data/trees/*.json` — human-edited, diffed in git |
| **Runtime storage** | SQLite for dev (`data/sace.db`), Postgres for anything else |
| **ORM** | SQLAlchemy 2.0 (`DeclarativeBase`, `Mapped[T]`) |
| **Schema layer above ORM** | Pydantic `Node`/`Tree` — the same models the API serializes |
| **Seed flow** | On server boot, if the DB has zero trees, load every `data/trees/*.json` and persist |

JSON remains the format you write trees in and commit to git. The DB is what the agent and the API talk to at runtime.

## Why a database, not just JSON

- **Mutability.** With the agent + UI now supporting tree CRUD (`POST/PUT/DELETE /api/v1/trees`), a hot, atomic, queryable store beats reloading files.
- **Concurrent reads.** Multiple in-flight runs read the same tree at once; SQLAlchemy + a session per request handles this cleanly.
- **Forward-compatible.** Conversations, messages, and runs *will* be SQLAlchemy tables too — see [04-conversation-schema.md](./04-conversation-schema.md). Putting trees there first establishes the pattern.
- **Production path.** SQLite for dev, Postgres for anything beyond a laptop. Same code paths via `SACE_DATABASE_URL`.

## On-disk layout

```
data/
├── sace.db                    # SQLite file (gitignored)
├── trees/                     # Source-of-truth JSON
│   ├── example-cs.json
│   ├── example-cooking.json
│   └── README.md
└── README.md
```

`data/*.db` is in `.gitignore`. The DB is regenerable from `data/trees/*.json` at any time — delete the file, restart the server, the trees come back.

## File schema (JSON)

A file is a serialized `Tree` (the Pydantic model):

```json
{
  "id": "cs",
  "name": "Computer science survey",
  "description": "A demo tree for testing routing on a broad CS topic.",
  "root": {
    "id": "cs",
    "title": "Computer science",
    "description": "The study of algorithms, computation, and information.",
    "detail": "",
    "children": [
      {
        "id": "cs.languages",
        "title": "Programming languages",
        "description": "Syntax, semantics, paradigms, and notable languages.",
        "detail": "",
        "children": [ ... ]
      }
    ]
  }
}
```

Validation chain:
1. `json.loads()` the file.
2. `Tree.model_validate(data)` — Pydantic checks `id` patterns, length caps, extra fields.
3. `TreeStore.create(tree)` — DFS flattens the recursive Node into rows; rejects duplicate `id`s; writes a `TreeRow` plus N `NodeRow`s in one transaction.

If any tree fails to load at seed time, the loader logs the exception and **skips that file** — the server still boots with the trees that do load. We want a half-broken playground over no playground.

## Boot sequence (lifespan hook)

```python
# backend/sace/api/app.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_db()                                          # CREATE TABLE IF NOT EXISTS

    session = get_session_factory()()
    try:
        if tree_count(session) == 0:                   # cold boot
            seed_from_json_directory(session, data_dir)
    finally:
        session.close()
    yield
```

- `init_db()` runs `Base.metadata.create_all(engine)` — idempotent; safe on every boot.
- Seeding only fires when the table is empty. Subsequent restarts use whatever is in the DB.
- This means **edits made via the API survive a restart**. Edits made to JSON files only matter for a fresh DB.

The trade-off is deliberate: once you start mutating trees through the UI, the JSON files become a backup, not the truth. To force a re-seed from JSON, delete `data/sace.db` and restart.

## Storage shape, two layers

```
┌─────────────────────────────────────────────────────────┐
│                    REST / Agent layer                    │
│   speaks in Pydantic Node / Tree (the API surface)       │
└─────────────────────────────────────────────────────────┘
                         ▲   ▼  (translation in TreeStore)
┌─────────────────────────────────────────────────────────┐
│              SQLAlchemy ORM (TreeRow, NodeRow)           │
│   adjacency list: nodes.parent_id → nodes.id              │
└─────────────────────────────────────────────────────────┘
                         ▲   ▼  (SQL)
┌─────────────────────────────────────────────────────────┐
│              SQLite (dev) / Postgres (prod)              │
└─────────────────────────────────────────────────────────┘
```

The router, the prompt builder, the answer composer never see a `NodeRow`. They see Pydantic `Node`s. The translation happens inside `TreeStore`.

## DB choice — SQLite now, Postgres next

| When | Choice | Why |
|---|---|---|
| Dev | SQLite (`sqlite:///./data/sace.db`) | Zero ops, one file, git-friendly to wipe |
| Anything beyond a laptop | Postgres via `SACE_DATABASE_URL=postgresql+psycopg://...` | Concurrent writes, real types, scale |
| Hosted | Supabase (Postgres + dashboard + auth path) | A `supabase/config.toml` already lives at the repo root, ready when we want it |

No code changes between them — SQLAlchemy abstracts the driver. The only thing to watch is SQLite's `check_same_thread=False` (set in `session.py`) which is the dev-only knob.

The Supabase config (`supabase/config.toml`) is not active by default; it is the *intent file* for when we want a Postgres-on-Supabase setup. To use it: `supabase start`, then point `SACE_DATABASE_URL` at the connection string Supabase prints.

## Generation scripts

Sometimes you want to seed a tree from an external source.

```
scripts/
├── seed_tree.py             # validate JSON → call TreeStore.create()
├── from_markdown.py         # convert a structured markdown outline → Tree (and JSON file)
└── stats.py                 # print depth, branching factor, mean description length
```

`stats.py` is worth its weight: bad routing usually starts with bad tree shape, and the cheapest signal is its branching factor.

## Conventions for tree authoring

Belongs in `data/trees/README.md`, repeated here for visibility:

- **Branching factor 3–7 per level.** Below 3, the level adds no information. Above 7, the router gets confused.
- **Depth ≤ 5.** Deeper trees mean more LLM calls and more compounding errors.
- **Descriptions distinguish, not describe.** A good description tells the router *why this branch and not its sibling*.
- **Detail can be empty for internal nodes.** Don't pad it.
- **One tree per domain.** Don't merge unrelated topics.

Heuristics. We will measure them as we go.

## What lives in the DB today (and what doesn't, yet)

| Persisted | Status |
|---|---|
| Trees + nodes | ✅ Implemented (`TreeRow`, `NodeRow`) |
| Conversations | 🚧 Designed; tables not yet added — see [04-conversation-schema.md](./04-conversation-schema.md) |
| Messages | 🚧 Same |
| Runs / `AgentState` | 🚧 Same |
| Events / SSE replay buffer | ❌ In-memory only by design (`EventBus`) |
| Prompt templates | ❌ On disk under `backend/sace/prompts/templates/` |

The Conversation/Message/Run schema in [04-conversation-schema.md](./04-conversation-schema.md) is written as if the tables existed; the *next* PR after the trees work lands them. That doc describes the target.
