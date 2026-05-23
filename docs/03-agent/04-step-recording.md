# Step recording

How a single iteration of the agent loop becomes an observable, replayable record.

## Goal

For every node the agent visits, the system must be able to answer:

- **Which node?** (`node_id`, breadcrumbs)
- **What did the LLM see?** (rendered prompt)
- **What did the LLM say?** (raw output)
- **What did we decide?** (parsed decision)
- **How long did it take?** (timings, tokens)

These are non-negotiable; everything else (UI, debugging, A/B testing) flows from this contract.

## The `TraceStep` (recap)

Already defined in [02-agent-state.md](./02-agent-state.md). Repeated here for context:

```python
TraceStep(
    step_idx,
    node_id,        # the node we were AT when deciding
    prompt,         # the rendered router prompt
    raw_output,     # the LLM's raw text
    decision,       # parsed: descend(child_id) | stop, + reasoning
    model,
    started_at, finished_at, latency_ms,
    input_tokens, output_tokens,
)
```

## Recording pipeline

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐    ┌──────────────┐
│ router_node  │───▶│ build TraceStep │───▶│ append to    │───▶│ emit on bus  │
│ (LG node)    │    │                 │    │ state.trace  │    │ (StepEvent)  │
└──────────────┘    └─────────────────┘    └──────────────┘    └──────────────┘
```

Two destinations:

1. **In-state**: `state["trace"].append(step)` — survives the run and is part of the final response.
2. **Event bus**: `emit(run_id, StepEvent.from_trace(step))` — pushed to any SSE subscriber for that run.

Both happen in `router_node`. They are deliberately *separate* — the state is the source of truth; the bus is a lossy live feed.

## Wall-clock measurement

```python
started_at = utcnow_iso()
t0 = time.perf_counter_ns()
raw = await llm.acomplete(prompt, model=model)
t1 = time.perf_counter_ns()
finished_at = utcnow_iso()
latency_ms = (t1 - t0) // 1_000_000
```

We use `perf_counter_ns` for the duration (monotonic) and `utcnow_iso()` for the absolute timestamps. Two different jobs.

## Token accounting

OpenAI returns `usage` on each call. We pass it through verbatim into the `TraceStep`. We do not attempt to count tokens client-side — the official count is the only one that bills.

## Event mapping

A `TraceStep` becomes a `StepEvent` for the SSE stream. The mapping is mostly identity, with two tweaks:

| Trace field | Event field | Note |
|---|---|---|
| `prompt` | `prompt_preview` | We send only the first ~2 KB by default; full prompt is fetchable via `GET /runs/{id}/steps/{idx}` |
| `raw_output` | `raw_output` | Full |
| `decision` | `decision` | Full |
| (all) | `node` | The cursor `Node` summary (title, description, parent breadcrumb) |
| (none) | `seq` | Monotonic int per run, increments every emit (not just steps) |

Truncating the prompt in the event stream keeps the SSE bandwidth sane without losing the full record (which is in `state["trace"]`).

## Special events

Aside from `step`, the loop emits:

| Event name | When | Carries |
|---|---|---|
| `start` | Run begins | `run_id`, `tree_id`, `query`, `model` |
| `step` | After each router call | `TraceStep` (with truncated prompt) |
| `visit` | After cursor moves | new `cursor_id`, `depth` |
| `answer_start` | Before answer LLM call | nothing |
| `answer_token` | (optional) streaming tokens of the answer | partial text |
| `final` | Final answer ready | full markdown answer, `stop_reason` |
| `error` | Anywhere on failure | message, partial state |
| `done` | Last event, always | totals: steps, tokens, ms |

The shapes are in [05-api/03-event-schema.md](../05-api/03-event-schema.md).

## Replay

To replay a run from a `trace.json`:

```python
state = AgentState.model_validate_json(open("trace.json").read())
for step in state["trace"]:
    print(step.node_id, step.decision)
```

To re-run with different prompts but the same model behavior, swap `llm` for a `ReplayLLM` that returns `step.raw_output` indexed by `step.step_idx`. This gives deterministic UI-only iteration.

## What we deliberately do not record

- **Embeddings.** We have none.
- **Intermediate streamed tokens of the router call.** Routers are short; we wait for the full completion.
- **Internal LangGraph events.** Translated to our schema and discarded.

## Privacy / sensitive data

There is no PII in v1. If we ever ingest user notes into trees, the trace will contain `detail` from those nodes. Mark such trees private and exclude them from logs. We will revisit when relevant.
