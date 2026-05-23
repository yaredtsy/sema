# Event schema

Strict shapes for every event that travels on the SSE stream. These are also the shapes that the frontend's reducer expects, whether the events come live or are reconstructed from a saved `AgentState` for replay.

## Envelope

Every event on the wire:

```
id: <seq>
event: <name>
data: <single-line JSON payload>
```

The payload always includes:

| Field | Type | Meaning |
|---|---|---|
| `seq` | int | Monotonic per run, starts at 1 |
| `run_id` | string | The run this belongs to |
| `conversation_id` | string | The conversation this run belongs to |
| `message_id` | string | The assistant message this run is producing |
| `ts` | string (ISO-8601) | Server timestamp at emit |

When events come over the multiplexed `/conversations/{cid}/stream`, the `run_id` is how the client routes them to the right assistant message in the chat.

## Pydantic models (canonical)

```python
# backend/sace/schema/events.py
from __future__ import annotations
from typing import Literal, Union
from pydantic import BaseModel


class EventBase(BaseModel):
    seq: int
    run_id: str
    conversation_id: str
    message_id: str
    ts: str


class StartEvent(EventBase):
    name: Literal["start"] = "start"
    tree_id: str
    query: str
    model: str
    policy: dict


class StepStartEvent(EventBase):
    """Fires BEFORE the LLM call for a step — gives the UI a target to fill in."""
    name: Literal["step_start"] = "step_start"
    step_idx: int
    node: NodeSummary
    breadcrumbs: list[NodeSummary]
    messages_in_preview: list[LLMMessagePreview]   # truncated content
    prompt_template_version: str


class ThinkingDeltaEvent(EventBase):
    """A chunk of CoT / reasoning text as the model produces it (when we stream).
    For non-streamed router calls this fires once with the full thinking after the fact."""
    name: Literal["thinking_delta"] = "thinking_delta"
    step_idx: int
    text: str


class ToolCallEvent(EventBase):
    """For future function-calling mode; carries one tool invocation."""
    name: Literal["tool_call"] = "tool_call"
    step_idx: int
    tool: ToolCallSummary                          # name, args, result


class StepEvent(EventBase):
    """Fires AFTER the step's LLM call resolves. Carries the full step record."""
    name: Literal["step"] = "step"
    step_idx: int
    node: NodeSummary
    breadcrumbs: list[NodeSummary]
    messages_in_preview: list[LLMMessagePreview]
    raw_output: str
    thinking: ThinkingSummary | None
    tool_calls: list[ToolCallSummary]
    decision: RoutingDecision
    model: str
    prompt_template_version: str
    latency_ms: int
    input_tokens: int | None
    output_tokens: int | None
    full_url: str                                  # GET /api/v1/runs/{run_id}/steps/{idx}


class VisitEvent(EventBase):
    name: Literal["visit"] = "visit"
    new_cursor_id: str
    depth: int


class AnswerStartEvent(EventBase):
    name: Literal["answer_start"] = "answer_start"
    messages_in_preview: list[LLMMessagePreview]
    prompt_template_version: str


class AnswerTokenEvent(EventBase):
    name: Literal["answer_token"] = "answer_token"
    text: str


class FinalEvent(EventBase):
    name: Literal["final"] = "final"
    text: str
    stop_reason: Literal["agent_stop", "leaf", "max_depth", "error", "empty_detail", "cancelled"]
    cursor_id: str


class ErrorEvent(EventBase):
    name: Literal["error"] = "error"
    code: str
    message: str
    fatal: bool


class DoneEvent(EventBase):
    name: Literal["done"] = "done"
    totals: Totals


class Totals(BaseModel):
    steps: int
    input_tokens: int
    output_tokens: int
    latency_ms: int


class NodeSummary(BaseModel):
    id: str
    title: str
    description: str


class LLMMessagePreview(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content_preview: str                           # truncated to ~2 KB
    content_truncated: bool


class ThinkingSummary(BaseModel):
    text: str
    is_synthetic: bool


class ToolCallSummary(BaseModel):
    id: str
    name: str
    arguments_preview: str
    result_preview: str | None


class RoutingDecision(BaseModel):
    kind: Literal["descend", "stop"]
    child_id: str | None = None
    reasoning: str
    confidence: float | None = None


Event = Union[
    StartEvent, StepStartEvent, ThinkingDeltaEvent, ToolCallEvent,
    StepEvent, VisitEvent,
    AnswerStartEvent, AnswerTokenEvent,
    FinalEvent, ErrorEvent, DoneEvent,
]
```

## Why `step_start` AND `step`

The chat-style debug view needs a placeholder to render before the LLM responds — otherwise the user stares at nothing for several hundred milliseconds. `step_start` carries the prompt-side context (node, breadcrumbs, messages) so the UI can render an "in progress" step card immediately. `step` carries the response-side fields (raw_output, decision, latency, tokens) and is essentially an *update* of the same step_idx.

Tree-overlay view does the same: highlight the node at `step_start`; show the decision in the side card at `step`.

## Why `thinking_delta` is separate

We want the inline chat-style view to stream the reasoning text the way Cursor streams CoT — as it arrives, not all at once. For router calls we currently parse `<reasoning>` from the final response (one `thinking_delta` emitted post-hoc), but the event shape is forward-compatible with a true streaming reasoning channel from a future model. The frontend renders the same way in both cases.

## Per-event reference (highlights)

### `start`

Once per run, before any step.

```json
{
  "name": "start", "seq": 1, "run_id": "01HQW...", "conversation_id": "...", "message_id": "...",
  "ts": "...", "tree_id": "cs", "query": "...", "model": "gpt-4.1-mini",
  "policy": { "max_depth": 5, "beam_width": 1 }
}
```

### `step_start` / `step`

Pair, in order. `step_start.step_idx == step.step_idx`. The frontend reducer treats them as upsert by `step_idx`.

### `thinking_delta`

May appear between `step_start` and `step`. May fire multiple times (streamed) or once (post-hoc). All deltas share `step_idx`; concat in order.

### `tool_call`

Future-compatible. Empty in v1 (no tools). When present, appears between `step_start` and `step`.

### `visit`

Tiny payload; pairs with the preceding `step`. UI animates the edge from previous cursor to `new_cursor_id`.

### `answer_start` / `answer_token` / `final`

The answer phase. `answer_token` fires per chunk when streaming the answer; `final` carries the full assembled text. If not streaming the answer, `answer_token` is absent.

### `error`

Anywhere on failure. `fatal: true` means the run is over (a `done` follows).

### `done`

Last event, always. Server closes the connection.

## Ordering guarantees

- `seq` strictly increasing per run.
- For a successful run with K steps:
  `start → (step_start → thinking_delta* → tool_call* → step → visit){K} → answer_start → answer_token* → final → done`.
- `error` may appear anywhere, except before `start` or after `done`.
- The reducer is idempotent on `step_idx` upserts.

## Reconstruction from a saved `AgentState`

The frontend doesn't only consume live SSE — it also rebuilds the trace from `GET /runs/{run_id}` when entering replay mode for a past message. The reconstruction generates synthetic events from the saved state in the same order a live run would have produced:

```ts
function eventsFromState(state: AgentState): Event[] {
  const out: Event[] = [];
  out.push({ name: "start", ... });
  state.trace.forEach((step, i) => {
    out.push({ name: "step_start", step_idx: i, node: ..., messages_in_preview: ..., ... });
    if (step.thinking) out.push({ name: "thinking_delta", step_idx: i, text: step.thinking.text });
    step.tool_calls.forEach(t => out.push({ name: "tool_call", step_idx: i, tool: ... }));
    out.push({ name: "step", step_idx: i, ... });
    out.push({ name: "visit", new_cursor_id: state.visited_ids[i + 1] ?? state.cursor_id, depth: i + 1 });
  });
  if (state.answer) {
    out.push({ name: "answer_start", ... });
    out.push({ name: "final", text: state.final_answer, ... });
  }
  out.push({ name: "done", totals: ... });
  return out;
}
```

This guarantees **live and replay produce identical UI state**, which is the whole point — same reducer, different source.

## Versioning

Event names are stable. New optional fields can be added (clients ignore unknown fields). Removing/renaming a field requires a new event name. No SemVer — we add names instead.
