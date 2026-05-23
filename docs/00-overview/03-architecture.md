# Architecture overview

A bird's-eye picture of the system. The metaphor (GPS history) is in [01-vision.md](./01-vision.md); the vocabulary is in [02-core-concepts.md](./02-core-concepts.md).

## Topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          React frontend (Vite)                            │
│                                                                            │
│  ┌────────────────────┐ ┌─────────────────────┐ ┌──────────────────────┐ │
│  │   Tree view        │ │  Debug panel        │ │  Chat panel          │ │
│  │  (the map)         │ │  (trip details)     │ │  (conversation)      │ │
│  │                    │ │                     │ │                      │ │
│  │  ● root            │ │  Target: msg #3 ▼   │ │ [user] q1            │ │
│  │  ├─ ● langs ✓      │ │  Mode: tree ⇄ chat  │ │ [ai]   ▶ thinking…   │ │
│  │  │  └─ ● py ✓      │ │                     │ │        ● step 0      │ │
│  │  └─ ○ frame        │ │  Step 0  cs         │ │        ● step 1      │ │
│  │                    │ │  → descend langs    │ │        answer ✓      │ │
│  │  (visited overlay  │ │  Step 1  cs.langs   │ │ [user] q2            │ │
│  │   for selected msg)│ │  → descend python   │ │ [ai]   live…   ◀sel  │ │
│  │                    │ │  ...                │ │                      │ │
│  └────────────────────┘ └─────────────────────┘ └──────────────────────┘ │
│                                                                            │
│     SSE: event stream             HTTP: conversations + messages           │
└──────────────────────────┬───────────────────────────┬───────────────────┘
                           │                           │
                           ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                Python backend (FastAPI + LangGraph)                       │
│                                                                            │
│  ┌──────────────┐   ┌─────────────────┐   ┌─────────┐   ┌────────────┐   │
│  │  REST API    │──▶│  ConversationMgr│──▶│ LG run  │──▶│ EventBus   │   │
│  │              │   │                 │   │ (one    │   │ per-run    │   │
│  │ /trees       │   │  - new msg →    │   │  per    │   │ queue +    │   │
│  │ /convs       │   │    new run      │   │  msg)   │   │ replay buf │   │
│  │ /msgs        │   │  - per-run state│   │         │   │            │   │
│  │ /runs/{id}   │   │                 │   └────┬────┘   └────────────┘   │
│  │ /events      │   └─────────────────┘        │                          │
│  └──────┬───────┘                              │                          │
│         │   Depends(get_session)               │                          │
│         ▼                                       ▼                          │
│  ┌──────────────────┐                ┌────────────────────┐               │
│  │  TreeStore       │◀──── reads ────│  (future)          │               │
│  │  (session-bound) │                │  ConversationStore │               │
│  └────────┬─────────┘                │  RunStore          │               │
│           │ SQLAlchemy 2.0           └─────────┬──────────┘               │
│           ▼                                     ▼                          │
│  ┌─────────────────────────────────────────────────────────────┐         │
│  │     SQLite (dev) — data/sace.db    OR    Postgres / Supabase │         │
│  │     tables today:  trees,  nodes                              │         │
│  │     tables planned: conversations, messages, runs            │         │
│  └─────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘
```

## Conversation lifecycle

1. **User opens the app** → frontend creates (or restores) a conversation. `POST /api/v1/conversations { tree_id }` returns a `conversation_id`. (In v1 we keep a single in-memory conversation per process; restoration is best-effort.)
2. **User sends a message** → `POST /api/v1/conversations/{cid}/messages { text }`. The backend:
   - Appends a `user` message.
   - Creates a `Run` with a fresh `run_id`.
   - Inserts an `assistant` message stub linked to that `run_id`.
   - Returns `{ message_id, run_id, events_url }`.
3. **Frontend opens SSE** to `/api/v1/events/{run_id}` (or to `/conversations/{cid}/stream` which multiplexes — see [05-api/02-sse-streaming.md](../05-api/02-sse-streaming.md)).
4. **Agent runs**:
   - Router node → LLM call → emit `step` event.
   - Visit node → emit `visit` event.
   - Loop until stop condition.
   - Answer node → optionally `answer_token` stream → `final` event.
5. **Frontend updates** the assistant message inline (chat-style debug view shows steps as they arrive) and, if the user has the tree-overlay debug view open on this message, the tree visualization animates.
6. **`done` event** closes the SSE; the run becomes a saved past trip.
7. **User can immediately**:
   - Send another message (a new run, parallel SSE).
   - Pick a previous message in the chat → debug panel and tree-overlay views snap to that message's run.

## Component responsibilities

| Component | Responsibility | Doesn't do |
|---|---|---|
| `db.session` | Lazy engine, request-scoped Session via `get_session()` | Domain logic |
| `db.models` | SQLAlchemy ORM (`TreeRow`, `NodeRow`, more later) | Pydantic / API translation |
| `TreeStore` (session-bound) | CRUD over trees + nodes; translate ORM rows ↔ Pydantic `Node`/`Tree` | LLM calls, prompts |
| `Renderer` | Turn a `Node` (or subtree) into prompt XML | Make decisions |
| `Router` (LG node) | One LLM call → parsed decision | Walk the tree |
| `AgentGraph` | Compose router/visit/answer; manage cursor + trace | Hold trees |
| `ConversationManager` | Map messages ↔ runs; persist via the (future) conversation tables | Run the agent itself |
| `RunRegistry` | Per-run lifecycle, cancellation, saved state retrieval | Conversation logic |
| `EventBus` | Per-run pub/sub for SSE, bounded replay buffer | Persist anything |
| `FastAPI app` | REST + SSE endpoints; CORS; lifespan (init DB, seed) | Prompting logic |

The boundaries are deliberate. Prompts in one module, tree logic in another, the graph in a third, conversation/run mapping in a fourth. Edit any one without breaking the others.

## Data flow boundary table

| Boundary | Direction | Shape | Notes |
|---|---|---|---|
| FE → BE | `POST /conversations` | `{ tree_id }` | Returns `conversation_id` |
| FE → BE | `POST /conversations/{cid}/messages` | `{ text, model?, params? }` | Returns `{ message_id, run_id, events_url }` |
| BE → FE | SSE per `run_id` | `event: start / step / visit / thinking / tool_call / answer_token / final / error / done` | One stream per run |
| FE → BE | `GET /conversations/{cid}` | — | Returns the full conversation incl. all messages + run summaries |
| FE → BE | `GET /runs/{run_id}` | — | Full `AgentState` for replay |
| Graph → Bus | function call | `Event` | Synchronous; bus pushes to async queue |
| Renderer → LLM | string | XML prompt | See context-engineering docs |
| LLM → Router | text | XML-tagged decision | Strict format with one retry |

## Why this shape

- **FastAPI** because it has first-class async + SSE support and integrates cleanly with LangGraph's async runtime.
- **LangGraph** because the loop is a graph (router → visit → router → ... → answer), and LangGraph gives us state, conditional edges, and observability hooks.
- **One run per assistant message** because it makes "go back and debug message N" a clean lookup — `runs[message.run_id]` — instead of slicing a global trace.
- **SSE over WebSocket** because traffic is one-way (server → client). SSE auto-reconnects, has no framing overhead, and trivially consumed by `EventSource`.
- **SQLAlchemy + SQLite (dev) / Postgres (later)** because trees are mutable through the API now, and a real store keeps the schema honest. JSON files become the *authoring* + *seed* format; the DB is the runtime truth. See [02-data-model/05-database-and-orm.md](../02-data-model/05-database-and-orm.md).

Each choice is reversible. Document the swap before making it.

## Replay-ability is a first-class property

Every `Run` is a complete, self-contained record. To re-render a past message's debug views, the backend serves `GET /runs/{run_id}` (full `AgentState`) and the frontend renders both views from that JSON. No re-execution; no SSE; deterministic.

This is exactly the GPS-history analogy: the trip is *saved*, and you can review it any time, in any view.

## Lifespan and boot

```
FastAPI lifespan
  1. setup_logging()
  2. init_db()                            ← Base.metadata.create_all(engine)
  3. open a short-lived Session
  4. if tree_count(session) == 0:          ← cold boot
        seed_from_json_directory(session, data/trees/)
  5. yield (server is live)
```

This means:
- Cloning the repo and running `make dev-backend` "just works" — no separate migration step, no manual seed command.
- Edits made via the API persist (the DB file is real).
- To reset to JSON: `rm data/sace.db` and restart.

## What is not in v1

- **Conversation/Message/Run tables**: designed (see [02-data-model/04-conversation-schema.md](../02-data-model/04-conversation-schema.md)), not yet implemented. Currently, conversations and runs would live in memory if the agent loop ran.
- **Alembic migrations**: `create_all` until the schema starts evolving (which is *when the conversation tables land*).
- **Multiple concurrent conversations per user**: one session, one conversation.
- **Branching / forking a message** ("what if the agent had picked the other child?"). Slot reserved — not built.
- **Editing past messages.** Append-only.
