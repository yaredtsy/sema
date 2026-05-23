# REST endpoints

All endpoints are prefixed `/api/v1`. Versioning is in the URL; we will bump to `/api/v2` if a breaking change ships.

## Conventions

- Request bodies and responses are JSON.
- Errors are `application/json` of shape `{"error": {"code": "...", "message": "..."}}` with appropriate HTTP status.
- IDs are short ULIDs unless they are tree/node ids (which are user-defined strings).
- Times are ISO-8601 strings, UTC.
- Pagination is not implemented in v1; collections are small.

## Endpoints

### `GET /api/v1/health`

Liveness. Returns `{"status": "ok"}`.

### `GET /api/v1/trees`

Lists all loaded trees with summary info.

**Response 200**
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

The full `Tree` object — root with all children, recursively.

**Response 200**: a serialized `Tree` (see [02-data-model/01-node-schema.md](../02-data-model/01-node-schema.md)).
**Response 404**: `tree_not_found`.

Used by the frontend on initial load to render the tree viz.

### `GET /api/v1/trees/{tree_id}/nodes/{node_id}`

A single node's full record, including `detail`. Used when the user clicks a node in the viz to read it.

**Response 200**
```json
{
  "node": { "id": "...", "title": "...", "description": "...", "detail": "...", "children": [...], "tags": [] },
  "breadcrumbs": [
    { "id": "cs", "title": "Computer science" },
    { "id": "cs.languages", "title": "Programming languages" }
  ]
}
```

### `POST /api/v1/query`

Start an agent run. Returns a `run_id`; the response does **not** contain the answer. The client subscribes to `/events/{run_id}` to receive the trace and final answer.

**Request**
```json
{
  "tree_id": "cs",
  "query": "How does Python's asyncio event loop work?",
  "model": "gpt-4.1-mini",
  "params": {
    "max_depth": 5,
    "beam_width": 1,
    "show_grandchildren": false
  }
}
```

`model` is optional; defaults to `SACE_MODEL` env. **The server rejects any non-mini model** (see [04-tech-stack.md](../00-overview/04-tech-stack.md)).

**Response 202**
```json
{
  "run_id": "01HQX...",
  "events_url": "/api/v1/events/01HQX..."
}
```

**Errors**
- `400 invalid_query` — empty query, query too long.
- `400 invalid_model` — non-mini model requested.
- `404 tree_not_found`.

### `GET /api/v1/events/{run_id}` (SSE)

The live event stream for a run. See [02-sse-streaming.md](./02-sse-streaming.md) for protocol details and [03-event-schema.md](./03-event-schema.md) for event shapes.

`Content-Type: text/event-stream`. The connection stays open until the run completes or the client disconnects.

### `GET /api/v1/runs/{run_id}`

Full record of a finished or in-flight run.

**Response 200**
```json
{
  "run_id": "01HQX...",
  "tree_id": "cs",
  "query": "...",
  "model": "gpt-4.1-mini",
  "status": "running|completed|cancelled|error",
  "trace": [ /* TraceStep[] */ ],
  "final_answer": "...",
  "stop_reason": "agent_stop",
  "started_at": "...",
  "finished_at": "...",
  "totals": { "steps": 4, "input_tokens": 4123, "output_tokens": 612, "latency_ms": 2890 }
}
```

If the run is still in-flight, `trace` reflects steps so far and `final_answer` is absent. This endpoint is the "give me everything" alternative to subscribing to SSE.

### `GET /api/v1/runs/{run_id}/steps/{idx}`

A single trace step with the **full** prompt (the SSE event truncates). Used by the trace panel's "show full prompt" toggle.

### `POST /api/v1/runs/{run_id}/cancel`

Idempotent. Marks the run as cancelled; the agent loop exits at the next safe point (between LLM calls).

**Response 200**: `{"run_id": "...", "status": "cancelled"}`.

### `POST /api/v1/admin/reload` (dev only)

Reload trees from disk. Optional query param `?tree_id=cs` to reload a single tree.

## Why this shape

- **`POST /query` returns a run id, not an answer.** The answer comes via SSE. Trying to keep an HTTP connection open for the full multi-step run is fragile; SSE is the right transport.
- **`/runs` is the cold-store mirror of the SSE.** Anything you saw stream can be re-fetched as JSON.
- **No PATCH on trees.** Trees are immutable per process.
- **No PATCH on runs.** Cancellation is the only state transition the client can drive; everything else is server-internal.

## CORS

Dev allows `http://localhost:5173`. Configured in `sace/api/app.py`. We do not enable cookies; everything is API-key headers if it ever needs auth.

## OpenAPI

FastAPI generates `/openapi.json` and `/docs` for free. We rely on it; no hand-written OpenAPI.
