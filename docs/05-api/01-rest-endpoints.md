# REST endpoints

All endpoints are prefixed `/api/v1`. Versioning is in the URL.

The API is organized around three resources: **trees** (the maps), **conversations** (lists of trips), and **runs** (individual trips). The SSE stream is a fourth surface — see [02-sse-streaming.md](./02-sse-streaming.md).

## Conventions

- Request bodies and responses are JSON.
- Errors are `application/json` of shape `{"error": {"code": "...", "message": "..."}}`.
- IDs are ULIDs except tree/node ids (user-defined strings).
- Times are ISO-8601 UTC.
- No pagination in v1.

---

## Trees

### `GET /api/v1/health`

Liveness. Returns `{"status": "ok"}`.

### `GET /api/v1/trees`

Lists loaded trees.

```json
{
  "trees": [
    {
      "id": "cs",
      "name": "Computer science survey",
      "description": "...",
      "node_count": 134,
      "depth": 4,
      "branching_factor_avg": 4.2
    }
  ]
}
```

### `GET /api/v1/trees/{tree_id}`

The full `Tree` object (root + all children).

**Errors**
- `404 not_found` — no such tree.

### `POST /api/v1/trees`

Create a new tree from a full `Tree` JSON. Used by `scripts/seed_tree.py` and by future authoring UIs.

**Request:** a serialized `Tree`.
**Response 201:** the persisted `Tree`.
**Errors**
- `409 conflict` — tree id already exists.
- `400 invalid` — duplicate node ids within the tree, or any Pydantic validation failure (422).

### `PUT /api/v1/trees/{tree_id}`

Replace a tree wholesale. The body's `Tree.id` must match the URL `tree_id`. Internally this wipes the tree's `nodes` rows and re-inserts — small trees and atomic transactions make the simple approach correct.

**Errors**
- `400 invalid` — body id ≠ URL id.
- `404 not_found` — tree doesn't exist.

### `DELETE /api/v1/trees/{tree_id}`

Removes the tree and (via `ON DELETE CASCADE`) all its nodes. Returns `204 No Content`.

**Errors**
- `404 not_found`.

### `GET /api/v1/trees/{tree_id}/nodes/{node_id}`

A single node, including `detail` and breadcrumbs.

```json
{
  "node": { "id": "...", "title": "...", "description": "...", "detail": "...", "children": [...], "tags": [] },
  "breadcrumbs": [ { "id": "cs", "title": "Computer science", "description": "..." }, ... ]
}
```

**Errors**
- `404 not_found` — node not present in that tree.

---

## Conversations

### `POST /api/v1/conversations`

Create a new conversation bound to a tree.

**Request**
```json
{ "tree_id": "cs" }
```

**Response 201**
```json
{
  "id": "01HQX...",
  "tree_id": "cs",
  "created_at": "2026-05-23T14:01:09Z",
  "messages": []
}
```

In v1 we typically keep one conversation per session; the frontend creates one on app boot.

### `GET /api/v1/conversations/{conversation_id}`

Full conversation with all messages.

```json
{
  "id": "...",
  "tree_id": "cs",
  "created_at": "...",
  "messages": [
    {
      "id": "...",
      "role": "user",
      "content": "How does Python's asyncio event loop work?",
      "created_at": "...",
      "status": "completed"
    },
    {
      "id": "...",
      "role": "assistant",
      "content": "# Async in Python\n\nPython's asyncio uses...",
      "run_id": "01HQY...",
      "created_at": "...",
      "status": "completed"
    },
    ...
  ]
}
```

### `POST /api/v1/conversations/{conversation_id}/messages`

Submit a new user message. Triggers an agent run for the assistant reply.

**Request**
```json
{
  "text": "How does Python's asyncio event loop work?",
  "model": "gpt-4.1-mini",
  "params": { "max_depth": 5, "beam_width": 1, "show_grandchildren": false }
}
```

`model` and `params` are optional. The server **rejects any non-mini model** (see [00-overview/04-tech-stack.md](../00-overview/04-tech-stack.md)).

**Response 202**
```json
{
  "user_message_id": "01HQU...",
  "assistant_message_id": "01HQV...",
  "run_id": "01HQW...",
  "events_url": "/api/v1/events/01HQW..."
}
```

The client then opens an SSE connection to `events_url` (or to the multiplexed conversation stream — see SSE doc).

### `GET /api/v1/conversations/{conversation_id}/messages/{message_id}`

A single message. The assistant message includes its `run_id`; clients usually go straight to `GET /runs/{run_id}` from there.

### `POST /api/v1/conversations/{conversation_id}/export`

Returns the conversation **plus** the full `AgentState` for every assistant message, in one JSON blob. The frontend's "Export" button downloads this directly. Git-friendly.

```json
{
  "conversation": { ... },                  // full Conversation
  "runs": {
    "01HQW...": { /* AgentState */ },
    "01HQZ...": { /* AgentState */ }
  }
}
```

### `POST /api/v1/conversations/import`

Accepts an exported JSON and rehydrates the in-memory conversation + runs. Useful for sharing reproducible debug sessions.

---

## Runs (per-message detail)

### `GET /api/v1/runs/{run_id}`

Full `AgentState` for one run. **This endpoint is the heart of the replay feature.**

```json
{
  "run_id": "01HQW...",
  "conversation_id": "01HQT...",
  "message_id": "01HQV...",
  "tree_id": "cs",
  "query": "How does Python's asyncio event loop work?",
  "model": "gpt-4.1-mini",
  "policy": { "max_depth": 5, ... },
  "started_at": "...", "finished_at": "...",
  "cursor_id": "cs.languages.python.async.event-loop",
  "depth": 4,
  "visited_ids": ["cs", "cs.languages", "cs.languages.python", "cs.languages.python.async", "cs.languages.python.async.event-loop"],
  "trace": [
    {
      "step_idx": 0,
      "node_id": "cs",
      "messages_in": [ {"role": "system", "content": "..."}, {"role": "user", "content": "<context>...</context>"} ],
      "raw_output": "<decision>...</decision>",
      "thinking": { "text": "The user asks about asyncio...", "is_synthetic": true },
      "tool_calls": [],
      "decision": { "kind": "descend", "child_id": "cs.languages", "reasoning": "...", "confidence": 0.88 },
      "model": "gpt-4.1-mini",
      "prompt_template_version": "router_v1",
      "started_at": "...", "finished_at": "...",
      "latency_ms": 410,
      "input_tokens": 932, "output_tokens": 64
    },
    ...
  ],
  "answer": {
    "messages_in": [ ... ],
    "raw_output": "# Async in Python\n\n...",
    "final_text": "# Async in Python\n\n...",
    "model": "gpt-4.1-mini",
    "prompt_template_version": "answer_v1",
    "started_at": "...", "finished_at": "...",
    "latency_ms": 1240,
    "input_tokens": 2100, "output_tokens": 480
  },
  "final_answer": "# Async in Python\n\n...",
  "stop_reason": "leaf"
}
```

The frontend's debug panel and tree-overlay view both render entirely from this payload.

### `GET /api/v1/runs/{run_id}/steps/{step_idx}`

A single trace step. Identical content to `runs[run_id].trace[step_idx]` — exists as a convenience for the "show full prompt" foldouts (which can lazy-load instead of carrying the full trace eagerly).

### `POST /api/v1/runs/{run_id}/cancel`

Idempotent. Marks the run as cancelled; the agent loop exits at the next safe point (between LLM calls). The associated message status becomes `cancelled`.

```json
{ "run_id": "...", "status": "cancelled" }
```

---

## Events (SSE)

### `GET /api/v1/events/{run_id}` (SSE)

Per-run event stream. See [02-sse-streaming.md](./02-sse-streaming.md) and [03-event-schema.md](./03-event-schema.md).

### `GET /api/v1/conversations/{conversation_id}/stream` (SSE, optional)

Multiplexed stream: events from every active run in the conversation, with `run_id` on each event. Lets the chat panel subscribe once and route events to the right assistant message. Behaves identically to N parallel `GET /events/{run_id}` connections.

---

## Admin (dev only)

### `POST /api/v1/admin/reload`

Re-seed trees from `data/trees/*.json` for trees that don't yet exist in the DB. Idempotent. Optional `?tree_id=cs` to attempt only one file. (To force-replace, use `PUT /api/v1/trees/{tree_id}` with a freshly loaded JSON body.)

---

## Why this shape

- **Conversation is first-class.** Messages and runs are children of a conversation. Lookup is `conversation → message → run` — exactly the path the debugger needs.
- **`POST /messages` is the only write that triggers work.** Everything else is reads.
- **`GET /runs/{id}` is the heart of replay.** Saving the full `AgentState` and serving it back is what makes both debug views deterministic and offline-friendly.
- **Export/import is manual persistence.** No DB; a JSON blob and a button. Cheap.

## OpenAPI

FastAPI generates `/openapi.json` and `/docs` for free. We rely on it.

## CORS

Dev allows `http://localhost:5173` and `http://127.0.0.1:5173`. No cookies — bearer header if we ever add auth.
