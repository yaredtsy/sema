# Event schema

Strict shapes for every event that travels on the SSE stream. These are also the shapes used in `state["trace"]` (for steps) and `GET /runs/{id}`.

## Envelope

Every event sent over SSE has this envelope at the wire level:

```
id: <seq>
event: <name>
data: <json payload>
```

The JSON payload is what's documented below.

## Common fields

Every payload includes:

| Field | Type | Meaning |
|---|---|---|
| `seq` | int | Monotonic per run, starts at 1, increments for every event |
| `run_id` | string | The run this belongs to |
| `ts` | string (ISO-8601) | Server timestamp at emit |

The remaining fields depend on the event name.

## Pydantic models (canonical)

```python
# backend/sace/schema/events.py
from __future__ import annotations
from typing import Literal, Union
from pydantic import BaseModel, Field


class EventBase(BaseModel):
    seq: int
    run_id: str
    ts: str


class StartEvent(EventBase):
    name: Literal["start"] = "start"
    tree_id: str
    query: str
    model: str
    params: dict


class StepEvent(EventBase):
    name: Literal["step"] = "step"
    step_idx: int
    node: NodeSummary               # id, title, description (no detail, no children)
    breadcrumbs: list[NodeSummary]
    prompt_preview: str             # first ~2 KB
    prompt_full_url: str            # GET /runs/{id}/steps/{idx}
    raw_output: str
    decision: RoutingDecision
    model: str
    latency_ms: int
    input_tokens: int | None
    output_tokens: int | None


class VisitEvent(EventBase):
    name: Literal["visit"] = "visit"
    new_cursor_id: str
    depth: int


class AnswerStartEvent(EventBase):
    name: Literal["answer_start"] = "answer_start"


class AnswerTokenEvent(EventBase):
    name: Literal["answer_token"] = "answer_token"
    text: str                       # incremental chunk


class FinalEvent(EventBase):
    name: Literal["final"] = "final"
    text: str                       # full answer markdown
    stop_reason: Literal["agent_stop", "leaf", "max_depth", "error", "empty_detail"]
    cursor_id: str


class ErrorEvent(EventBase):
    name: Literal["error"] = "error"
    code: str
    message: str
    fatal: bool                     # if True, the run is over


class DoneEvent(EventBase):
    name: Literal["done"] = "done"
    totals: Totals


class Totals(BaseModel):
    steps: int
    input_tokens: int
    output_tokens: int
    latency_ms: int                 # wall-clock from start → done


class NodeSummary(BaseModel):
    id: str
    title: str
    description: str


class RoutingDecision(BaseModel):
    kind: Literal["descend", "stop"]
    child_id: str | None = None
    reasoning: str
    confidence: float | None = None


Event = Union[
    StartEvent, StepEvent, VisitEvent,
    AnswerStartEvent, AnswerTokenEvent,
    FinalEvent, ErrorEvent, DoneEvent,
]
```

## Per-event reference

### `start`

Emitted exactly once, before any router call.

```json
{
  "name": "start",
  "seq": 1,
  "run_id": "01HQX...",
  "ts": "2026-05-23T14:01:09Z",
  "tree_id": "cs",
  "query": "How does Python's asyncio event loop work?",
  "model": "gpt-4.1-mini",
  "params": { "max_depth": 5, "beam_width": 1 }
}
```

### `step`

One per router LLM call.

```json
{
  "name": "step",
  "seq": 2,
  "run_id": "01HQX...",
  "ts": "2026-05-23T14:01:11Z",
  "step_idx": 0,
  "node": { "id": "cs", "title": "Computer science", "description": "..." },
  "breadcrumbs": [{ "id": "cs", "title": "Computer science", "description": "..." }],
  "prompt_preview": "<context>...</context>",
  "prompt_full_url": "/api/v1/runs/01HQX.../steps/0",
  "raw_output": "<decision>...</decision>",
  "decision": {
    "kind": "descend",
    "child_id": "cs.languages",
    "reasoning": "The query is about Python; the languages branch is the right next step.",
    "confidence": 0.88
  },
  "model": "gpt-4.1-mini",
  "latency_ms": 410,
  "input_tokens": 932,
  "output_tokens": 64
}
```

### `visit`

Emitted after the cursor moves. Tiny payload — purely for the UI to animate.

```json
{
  "name": "visit",
  "seq": 3,
  "run_id": "01HQX...",
  "ts": "...",
  "new_cursor_id": "cs.languages",
  "depth": 1
}
```

### `answer_start`

Emitted right before the answer LLM call.

```json
{ "name": "answer_start", "seq": 10, "run_id": "...", "ts": "..." }
```

### `answer_token` (optional)

Streaming tokens of the final answer. If we use non-streaming answer mode, this event is absent and we go straight to `final`.

```json
{ "name": "answer_token", "seq": 11, "run_id": "...", "ts": "...", "text": "Python's asyncio uses..." }
```

### `final`

The full answer.

```json
{
  "name": "final",
  "seq": 25,
  "run_id": "...",
  "ts": "...",
  "text": "# Async in Python\n\nPython's asyncio is...",
  "stop_reason": "leaf",
  "cursor_id": "cs.languages.python.async.event-loop"
}
```

### `error`

Anywhere on failure. May be non-fatal (e.g. parse retry succeeded) or fatal (the run ends).

```json
{
  "name": "error",
  "seq": 7,
  "run_id": "...",
  "ts": "...",
  "code": "parse_failed",
  "message": "Router output missing <decision> block; retrying once.",
  "fatal": false
}
```

### `done`

Always the last event. Emitted on success, cancellation, or fatal error.

```json
{
  "name": "done",
  "seq": 26,
  "run_id": "...",
  "ts": "...",
  "totals": { "steps": 4, "input_tokens": 4123, "output_tokens": 612, "latency_ms": 2890 }
}
```

After `done`, the server closes the connection.

## Ordering guarantees

- `seq` is strictly increasing per run.
- For a successful run: `start` → `step` × N → `visit` × N (interleaved appropriately) → `answer_start` → (`answer_token` × M) → `final` → `done`.
- `error` can appear anywhere (except before `start` or after `done`).
- The server may emit a `step` and the matching `visit` back-to-back; the client should treat them as a pair.

## Versioning

Event names are stable. New fields can be added (clients ignore unknown fields). Removing or renaming a field requires a new event name. We do not version events via SemVer; we version by adding new event names if we ever need to.
