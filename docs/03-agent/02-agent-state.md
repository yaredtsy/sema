# Agent state

The `AgentState` is the single source of truth that flows through the LangGraph run. It is a `TypedDict` (LangGraph's preferred shape) but with a Pydantic mirror for validation.

## Goals

1. **Serializable.** Every field is JSON-able. Anything that isn't (event bus handle, the `Tree` object reference) lives outside the state.
2. **Minimal.** If something can be derived (e.g. breadcrumbs from `cursor_id`), it isn't stored.
3. **Append-only where possible.** `trace` and `events_emitted` only grow. Easier to reason about.

## Shape

```python
# backend/sace/schema/state.py
from __future__ import annotations
from typing import TypedDict, Literal, NotRequired
from pydantic import BaseModel


class RoutingDecision(BaseModel):
    """One routing LLM output, parsed."""
    kind: Literal["descend", "stop"]
    child_id: str | None = None         # set when kind == "descend"
    reasoning: str                       # short, model-provided rationale
    confidence: float | None = None      # optional, 0..1


class TraceStep(BaseModel):
    """One iteration of the loop."""
    step_idx: int
    node_id: str                         # the node the router was deciding FROM
    prompt: str                          # the rendered router prompt (for replay)
    raw_output: str                      # the LLM's raw text
    decision: RoutingDecision
    model: str                           # e.g. "gpt-4.1-mini"
    started_at: str                      # ISO-8601
    finished_at: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None


class AgentState(TypedDict):
    # inputs (set once)
    run_id: str
    tree_id: str
    query: str
    model: str
    max_depth: int

    # walking state (updated each step)
    cursor_id: str                       # current node id; starts at tree.root.id
    depth: int                           # cursor's depth from root
    visited_ids: list[str]               # ordered, includes cursor and ancestors actually descended into

    # accumulated reasoning
    trace: list[TraceStep]               # one per router call
    final_answer: NotRequired[str]       # set by the answer node
    stop_reason: NotRequired[Literal["agent_stop", "max_depth", "leaf", "error"]]

    # error envelope (set if a node failed)
    error: NotRequired[str]
```

## Why a Pydantic `TraceStep` inside a `TypedDict`

LangGraph wants the outer container as a `TypedDict` for state-merging semantics. But each `TraceStep` has invariants (e.g. `latency_ms ≥ 0`, `confidence ∈ [0,1]`) we want validated at construction. The split keeps both worlds.

## State transitions

| When | Field updated | By |
|---|---|---|
| Run start | all `input` fields, `cursor_id = root`, `depth = 0`, empty lists | API handler |
| After router call | `trace.append(step)` | `router_node` |
| After visit | `cursor_id`, `depth`, `visited_ids.append(cursor_id)` | `visit_node` |
| Stop condition met | `stop_reason` | `visit_node` |
| Final answer composed | `final_answer` | `answer_node` |
| Anywhere on failure | `error`, `stop_reason="error"` | exception handler in graph |

## What is NOT in the state

| Not in state | Why |
|---|---|
| The `Tree` object | Looked up from `TreeStore` by `tree_id` on every node call. Don't carry mutable references through the graph. |
| The event bus | Side effect; not part of state. Passed via LangGraph's `config` or a closure. |
| Cumulative tokens | Computed from `trace` if needed. |
| The user's chat history | This experiment is single-turn per run. Multi-turn comes later (separate doc). |
| Random seeds, prompts as templates | Live in `prompts/`. State holds the *rendered* prompt for replay, nothing else. |

## Replay

Because every `TraceStep` stores its rendered prompt and raw output, a trace is a complete record of the run. We can:

- **Re-render** the UI without re-running the model.
- **Re-run** with a tweaked prompt by replacing `trace[i].prompt` and re-querying the model — useful for prompt A/B.
- **Diff** two runs of the same query on different models.

The export script is `scripts/export_trace.py`. The format is the `AgentState` JSON dump verbatim.

## Concurrency notes

LangGraph state updates are serial within a single run. We never write to `AgentState` from two coroutines. The event bus is the *only* concurrent thing — many subscribers, one producer.
