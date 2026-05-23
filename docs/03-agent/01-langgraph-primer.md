# LangGraph primer for this project

This is a *just-enough* introduction so the rest of the agent docs make sense. If you've used LangGraph before, skim and skip.

## What LangGraph is

LangGraph is a small library that lets you define an agent as a **state machine**:

- A **state** — a dictionary (`TypedDict`) carried between steps.
- **Nodes** — functions that read the state and return a partial state update.
- **Edges** — wiring. Either *static* (always go from A to B) or *conditional* (a function looks at the state and picks the next node).

The compiled graph is invokable like a function: `graph.invoke(initial_state)` or, more usefully for us, `graph.astream(initial_state)` which yields each state update as it happens.

## Why we use it (vs. a plain loop)

A naive implementation of the traversal is `while not done: pick_next()`. That works. LangGraph gives us, for free:

1. **State snapshotting.** Each step is checkpointed; we can replay or fork a run.
2. **Streaming events.** `astream_events` gives us per-node start/end events without us adding logging.
3. **Conditional edges.** Stop conditions become declarative (a function returns `"continue"` or `"done"`), which keeps the loop logic out of node functions.
4. **A standard mental model.** When the system gets more complex (e.g. parallel children, sub-graphs), the abstractions are already there.

If LangGraph turns out to add more friction than it saves, the whole thing is replaceable with a 30-line loop. The API surface we use is small on purpose.

## The pieces, in our terms

| LangGraph concept | Our usage |
|---|---|
| `StateGraph` | The agent shape; built once in `agent/graph.py` |
| `AgentState` (TypedDict) | Carries `query`, `tree_id`, `cursor`, `trace`, `final_answer`, plus event bus handle |
| Node `router` | One routing decision (one LLM call) |
| Node `visit` | Updates `cursor`; decides loop vs. stop via conditional edge |
| Node `answer` | Generates the final answer from `trace` + cursor's `detail` |
| Edge `router → visit` | Static |
| Edge `visit → router OR answer` | Conditional; depends on whether the agent said "stop" or hit max depth |
| `astream_events` | Source of our SSE events |

## The graph, sketched

```
        ┌─────────┐
START → │ router  │ ── (always) ──▶ ┌────────┐
        └─────────┘                  │ visit  │
             ▲                       └───┬────┘
             │                           │
             │ "descend"                  │ "stop" or "max_depth"
             └───────────────────────────┤
                                         ▼
                                    ┌─────────┐
                                    │ answer  │ ──▶ END
                                    └─────────┘
```

`router` always feeds into `visit`. `visit` reads the routing decision and either loops back to `router` (descending into the chosen child) or transitions to `answer` to produce the final reply.

## Streaming events

We listen with `astream_events(state, version="v2")`. Each event has a `name` like `on_chain_start`, `on_chat_model_stream`, `on_chain_end`. We translate the ones we care about into our own `StepEvent` shape (see [04-step-recording.md](./04-step-recording.md)) and push them on the per-run event bus.

We do *not* surface raw LangGraph events to the frontend. Our event schema is stable; the LangGraph one is internal.

## Where to look

- The graph itself: `backend/sace/agent/graph.py`
- The state: `backend/sace/schema/state.py`
- The nodes: `backend/sace/agent/{router_node,visit_node,answer_node}.py`
- The translator from LG events → our `StepEvent`: `backend/sace/events/emit.py`

## Things we are intentionally not using

- **Checkpointers (SQLite/Postgres).** No persistence yet. State is per-run, in memory.
- **Subgraphs.** Until the loop is solid, we keep it flat.
- **Human-in-the-loop interrupts.** Maybe later when we add manual override.
- **LangSmith.** Useful but adds a network dependency; our own SSE viewer is the playground.
