# Agent state

The `AgentState` is the single source of truth that flows through one LangGraph run. It is also the **saved trip log** — the JSON that the frontend reads to replay any past message in either debug view.

Definitions of `Conversation` / `Message` / `Run` are in [02-data-model/04-conversation-schema.md](../02-data-model/04-conversation-schema.md). This doc focuses on the per-run state.

## Goals

1. **Serializable.** Every field is JSON-able. We persist the state verbatim as the run record.
2. **Minimal.** If something can be derived (breadcrumbs from `cursor_id`), it isn't stored.
3. **Append-only where possible.** `trace`, `messages`, and `events_emitted` only grow. Easier to reason about; safer for live re-renders.
4. **Replayable.** A `Run` is its `AgentState`. Nothing about the agent's behavior is implicit; everything that influenced it lands in the state.

## Shape

```python
# backend/sace/schema/state.py
from __future__ import annotations
from typing import TypedDict, Literal, NotRequired
from pydantic import BaseModel


class LLMMessage(BaseModel):
    """One message exchanged with the LLM (chat-completions style)."""
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    # optional, for OpenAI tool calls if we adopt function calling later
    tool_call_id: str | None = None
    name: str | None = None


class ToolCall(BaseModel):
    """A structured tool invocation (for future function-calling mode)."""
    id: str
    name: str
    arguments: dict
    result: str | None = None                # filled after execution


class ThinkingTrace(BaseModel):
    """Captured chain-of-thought or reasoning content, when surfaced."""
    text: str                                # the LLM's reasoning prose
    is_synthetic: bool = False               # True if WE structured the prompt to elicit CoT
                                             # (vs. coming from a thinking-mode API response)


class RoutingDecision(BaseModel):
    """One routing LLM output, parsed."""
    kind: Literal["descend", "stop"]
    child_id: str | None = None
    reasoning: str
    confidence: float | None = None


class TraceStep(BaseModel):
    """One iteration of the loop. The atomic unit of the route."""
    step_idx: int
    node_id: str                             # the node the router was deciding FROM
    # the exact messages we sent the LLM at this step — replayable
    messages_in: list[LLMMessage]
    # the LLM's raw text output (after the chat completion returns)
    raw_output: str
    # parsed pieces
    thinking: ThinkingTrace | None = None
    tool_calls: list[ToolCall] = []          # empty in v1 (no tools); kept for future
    decision: RoutingDecision
    # bookkeeping
    model: str
    prompt_template_version: str             # e.g. "router_v1"
    started_at: str
    finished_at: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None


class AnswerComposition(BaseModel):
    """The final answer step, kept separately because its shape differs from a routing step."""
    messages_in: list[LLMMessage]
    raw_output: str
    final_text: str                          # what the user sees (markdown)
    model: str
    prompt_template_version: str
    started_at: str
    finished_at: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None


class AgentState(TypedDict):
    # ── identifiers ─────────────────────────────────────────────
    run_id: str
    conversation_id: str
    message_id: str                           # the assistant message this run produces
    tree_id: str

    # ── inputs (set once) ───────────────────────────────────────
    query: str
    model: str
    policy: dict                              # serialized TraversalPolicy
    started_at: str

    # ── walking state (updated per step) ────────────────────────
    cursor_id: str                            # current node id
    depth: int
    visited_ids: list[str]                    # in descent order, including root

    # ── trace (the route) ───────────────────────────────────────
    trace: list[TraceStep]                    # one per router LLM call
    answer: NotRequired[AnswerComposition]    # set by the answer node

    # ── outcome ─────────────────────────────────────────────────
    final_answer: NotRequired[str]
    stop_reason: NotRequired[Literal["agent_stop", "max_depth", "leaf", "error", "empty_detail", "cancelled"]]
    finished_at: NotRequired[str]

    # ── error envelope (set on failure) ─────────────────────────
    error: NotRequired[str]
```

## Why `messages_in` per step

We store the *list of chat messages* sent to the LLM at each step (system + user, or just user), not just the rendered prompt blob. Two reasons:

1. **The chat-style debug view** in the frontend wants to render these as proper chat bubbles inside the assistant message — system message, user message with the XML context, the model's response. That's what makes the inline debug feel like a familiar agent UI (Cursor-style).
2. **The tree-overlay debug view** lets you click a visited node and see the full exchange that happened there. Same data; different presentation.

Both views derive from `trace[i].messages_in + trace[i].raw_output`.

## Why `thinking` is its own field

OpenAI mini models do not (today) return separate "reasoning" tokens the way the o-series does. But we still ask for `<reasoning>...</reasoning>` inside the XML output. We parse that and store it under `thinking` so the frontend can render it as a "thinking" block — even though it came from the same completion, not a separate channel.

If we later adopt a model with a true reasoning channel, the same field captures it. `is_synthetic = True` means "we elicited this with prompt engineering"; `False` means it came from the API as a separate output.

## State transitions

| When | Field updated | By |
|---|---|---|
| Run start | identifiers, inputs, `cursor_id = root`, empty lists, `started_at` | API handler / ConversationManager |
| After router LLM call | `trace.append(step)` | `router_node` |
| After cursor move | `cursor_id`, `depth`, `visited_ids.append(cursor_id)` | `visit_node` |
| Stop reached | `stop_reason` | `visit_node` |
| Answer composed | `answer`, `final_answer`, `finished_at` | `answer_node` |
| Cancelled | `stop_reason = "cancelled"`, `finished_at` | graph cancel hook |
| Exception | `error`, `stop_reason = "error"`, `finished_at` | graph error handler |

## What is NOT in the state

| Not in state | Why |
|---|---|
| The `Tree` object | Looked up from `TreeStore` by `tree_id` on every node call. |
| The event bus | Side effect; passed via LangGraph config / closure. |
| Prior conversation turns | In v1, each run is independent. Live in `Conversation.messages`. |
| Streaming token buffer | `final_answer` holds the full composed text; intermediate tokens go to SSE only. |
| LangGraph internal events | We translate to our own events; raw LG events are discarded. |

## Concurrency

LangGraph state updates are serial within one run. We do **not** write to `AgentState` from two coroutines. The event bus is the only concurrent thing — many subscribers, one producer.

Two runs (for two different messages) execute as two independent LangGraph invocations with independent states. They share only the `TreeStore` (read-only) and the `EventBus` (per-run keys).

## Replay = render from saved state

To re-render a past message in either debug view:

1. Frontend asks `GET /runs/{run_id}` → backend returns the `AgentState` JSON.
2. Frontend reduces over `trace` exactly the way the live SSE handler would, producing the same `traceStore` shape.
3. Both the chat-style and tree-overlay views render the same way they do for the live run.

No special code path. Live and replay are the same UI; they just differ in where the events come from (SSE vs. the saved JSON). See [06-frontend/04-debug-panel.md](../06-frontend/04-debug-panel.md).

## Size budget

A typical run: depth 5 × ~3 KB per step (XML prompt + reasoning + decision) + a ~5 KB answer composition = ~20 KB JSON. Conversations with 50 messages still fit comfortably in memory.

If we adopt streaming `answer_token` rendering on the backend, we *only* store the assembled `final_text` — not the per-token chunks. The chunks were transient and the assembled text is canonical.
