# Architecture overview

A bird's-eye picture of the system. Detail lives in the per-domain docs.

## Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    React frontend (Vite)                    │
│                                                              │
│   ┌────────────────────────────┐  ┌──────────────────────┐  │
│   │   Tree visualization        │  │    Chat panel        │  │
│   │   (D3 or React Flow)        │  │                      │  │
│   │                             │  │  [user] question     │  │
│   │   ● root                    │  │  [ai]   answer       │  │
│   │   ├─ ● langs   ← current    │  │                      │  │
│   │   │  └─ ● python ← next     │  │  > _                 │  │
│   │   └─ ○ frameworks           │  └──────────────────────┘  │
│   └────────────────────────────┘                             │
│                                                              │
│       SSE: step events                  HTTP: POST query     │
└──────────────┬─────────────────────────────────┬─────────────┘
               │                                 │
               ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Python backend (FastAPI + LangGraph)           │
│                                                              │
│   ┌──────────────┐    ┌────────────────────┐   ┌─────────┐  │
│   │  REST API    │    │  LangGraph agent   │   │ SSE bus │  │
│   │              │───▶│                    │──▶│         │  │
│   │ /query       │    │  state: AgentState │   │ per-run │  │
│   │ /tree        │    │  nodes: router,    │   │ queue   │  │
│   │ /trees       │    │         visit,     │   │         │  │
│   │ /events      │    │         answer     │   └─────────┘  │
│   └──────────────┘    └─────────┬──────────┘                │
│                                 │                            │
│                                 ▼                            │
│                       ┌────────────────────┐                │
│                       │  TreeStore         │                │
│                       │  (in-memory + JSON)│                │
│                       └────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Request lifecycle

1. **User types a question** in the chat panel → `POST /api/v1/query { tree_id, query }` returns `{ run_id }`.
2. **Frontend opens an SSE connection** to `GET /api/v1/events/{run_id}`.
3. **Backend starts a LangGraph run** with `AgentState { query, tree, cursor=root, trace=[] }`.
4. **Router node** is invoked: builds the routing prompt for the cursor, calls the LLM, parses the decision.
5. **Step event is emitted** to the SSE bus. Frontend updates: current node highlighted, decision shown.
6. **Visit node** updates the cursor and decides whether to recurse (descend) or terminate (answer).
7. **Loop** until a terminal condition (leaf reached, agent says stop, max depth).
8. **Answer node** builds the final answer using the visited nodes' `detail` and emits a `final` event.
9. **SSE connection closes** with a `done` event.

## Component responsibilities

| Component | Responsibility | Doesn't do |
|---|---|---|
| `TreeStore` | Hold trees, look up by id, return a node + its children | LLM calls, prompts |
| `Renderer` | Turn a `Node` (or subtree) into the prompt's XML | Make decisions |
| `Router` (LG node) | One LLM call → parsed decision | Walk the tree |
| `AgentGraph` | Compose router/visit/answer; manage cursor + trace | Hold trees |
| `EventBus` | Per-run queue of step events for SSE | Persist anything |
| `FastAPI app` | REST + SSE endpoints, run dispatch | Prompting logic |

The boundaries are deliberate: prompts live in one module, tree logic in another, the graph in a third. We want to be able to A/B prompts without touching the graph and reshape the tree without touching prompts.

## Data flow boundary table

| Boundary | Direction | Shape | Notes |
|---|---|---|---|
| FE → BE | `POST /query` | `{ tree_id, query, model?, params? }` | Returns `run_id` |
| BE → FE | SSE | `event: step / final / error / done` | One stream per run |
| Graph → Bus | function call | `StepEvent` | Synchronous; bus pushes to async queue |
| Renderer → LLM | string | XML prompt | See context-engineering docs |
| LLM → Router | text | XML-tagged decision | Strict format with one retry |

## Why this shape

- **FastAPI** because it has first-class async + SSE support and integrates cleanly with LangGraph's async runtime.
- **LangGraph** because the loop is a graph (router → visit → router → ... → answer), and LangGraph gives us state, conditional edges, and free observability hooks.
- **SSE over WebSocket** because traffic is one-way (server → client). SSE auto-reconnects, has no framing overhead, and is trivial to consume with `EventSource`.
- **In-memory store** for v1 because trees are small (kilobytes) and we want to iterate fast. JSON files on disk are the "persistence".

Each of these choices is reversible. Document the swap before making it.
