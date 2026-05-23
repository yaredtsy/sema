# Backend layout

The Python package lives in `backend/sace/`. Each subpackage has one responsibility. Below is the full tree with the *intent* of each file.

```
backend/
├── sace/
│   ├── __init__.py
│   │
│   ├── config.py                  # env vars (OPENAI_API_KEY, MODEL_NAME, LOG_LEVEL), Settings via pydantic-settings
│   │
│   ├── schema/                    # Pydantic models — the type backbone of the project
│   │   ├── __init__.py
│   │   ├── node.py                # Node, Tree
│   │   ├── events.py              # StepEvent, FinalEvent, ErrorEvent, EventEnvelope
│   │   ├── api.py                 # QueryRequest, QueryResponse, TreeSummary
│   │   └── state.py               # AgentState (LangGraph TypedDict)
│   │
│   ├── store/                     # Persistence (JSON files for now)
│   │   ├── __init__.py
│   │   ├── tree_store.py          # TreeStore: load, get, find_by_id, breadcrumbs
│   │   └── json_loader.py         # read/validate JSON tree files
│   │
│   ├── prompts/                   # All prompt logic — no LLM calls here, just strings
│   │   ├── __init__.py
│   │   ├── render_xml.py          # render a Node + children into XML
│   │   ├── router_prompt.py       # routing decision prompt builder
│   │   ├── answer_prompt.py       # final answer prompt builder
│   │   └── templates/             # raw .txt or .jinja templates if we extract them
│   │
│   ├── llm/                       # LLM access — mini models only
│   │   ├── __init__.py
│   │   ├── chat_model.py          # make_chat_model() — raises if non-mini requested
│   │   └── parsers.py             # XML parsers for routing decisions
│   │
│   ├── agent/                     # LangGraph graph and graph nodes
│   │   ├── __init__.py
│   │   ├── graph.py               # build_graph() — compiles the StateGraph
│   │   ├── router_node.py         # one routing-decision step
│   │   ├── visit_node.py          # update cursor, decide loop/stop
│   │   ├── answer_node.py         # produce final answer from trace
│   │   └── policies.py            # max_depth, beam width, stop conditions
│   │
│   ├── events/                    # Per-run event bus
│   │   ├── __init__.py
│   │   ├── bus.py                 # in-memory pub/sub keyed by run_id
│   │   └── emit.py                # helpers used by graph nodes
│   │
│   ├── api/                       # FastAPI app
│   │   ├── __init__.py
│   │   ├── app.py                 # create_app(), CORS, lifespan
│   │   ├── deps.py                # FastAPI Depends (store, bus, model factory)
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── trees.py           # GET /trees, GET /trees/{id}, GET /trees/{id}/node/{node_id}
│   │   │   ├── query.py           # POST /query → run_id
│   │   │   └── events.py          # GET /events/{run_id} (SSE)
│   │   └── runs.py                # RunRegistry: in-flight runs, cancellation
│   │
│   └── util/
│       ├── __init__.py
│       ├── logging.py             # structured logs (JSON, run_id-tagged)
│       └── ids.py                 # short ULID-style ids for runs and events
│
├── tests/
│   ├── conftest.py
│   ├── unit/
│   │   ├── test_render_xml.py
│   │   ├── test_router_prompt.py
│   │   ├── test_parsers.py
│   │   ├── test_tree_store.py
│   │   └── test_policies.py
│   ├── integration/
│   │   ├── test_graph_smoke.py    # full traversal with a fake LLM
│   │   ├── test_sse.py
│   │   └── test_query_endpoint.py
│   └── fixtures/
│       ├── trees/
│       └── llm_replies/           # canned LLM outputs for deterministic tests
│
└── pyproject.toml (uses repo-root pyproject.toml — see monorepo doc)
```

## Dependency direction

Allowed imports (top → can import from anything below it):

```
api  →  agent  →  prompts , llm , events , store , schema
```

Stricter: `schema` imports nothing internal. `prompts` imports only `schema`. `llm` imports only `schema`. `store` imports only `schema`. The graph (`agent/`) is the only place that wires them together.

This means: you can read any file in `prompts/`, `schema/`, or `store/` in isolation. They have no surprise dependencies.

## Entry points

| Command | Does |
|---|---|
| `uv run uvicorn sace.api.app:create_app --factory --reload` | Dev server |
| `uv run python -m sace.scripts.seed` | Load `data/trees/*.json` into a fresh store |
| `uv run pytest` | Tests |

## Configuration

`sace/config.py` exports a single `Settings` from `pydantic-settings`. Required env vars:

| Var | Example | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | Required |
| `SACE_MODEL` | `gpt-4.1-mini` | Default; **must be a mini-tier model** |
| `SACE_MAX_DEPTH` | `5` | Traversal safety bound |
| `SACE_LOG_LEVEL` | `INFO` | |

`make_chat_model()` validates `SACE_MODEL` against an allowlist and raises if it isn't a mini model.

## What goes where — quick rules

| Question | Answer |
|---|---|
| "Where does this prompt string live?" | `prompts/` |
| "Where do we decide to descend vs. stop?" | `agent/router_node.py` and `agent/policies.py` |
| "Where is the loop?" | `agent/graph.py` (LangGraph edges) |
| "Where do we read a tree from disk?" | `store/json_loader.py` |
| "Where do we add a new event type?" | `schema/events.py` *and* `events/emit.py` |
| "Where is the SSE handler?" | `api/routes/events.py` |
| "Where does cancellation happen?" | `api/runs.py` |
