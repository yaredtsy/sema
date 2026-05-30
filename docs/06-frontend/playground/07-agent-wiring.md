# Agent wiring

> **Status — future, marked v1.5 unless tagged otherwise.** Today `useSendMessage` is a 600 ms timeout that appends a fake assistant reply. This doc describes how it lights up once the LangGraph agent ships. The frontend can be built ahead of the backend — every contract here is the seam between them.

The agent's job is one thing: take a question, walk the tree like a spider (Human → AI tool_calls → Tool results → … → final answer), emit each step. The frontend's job is to render the walk as it happens and to replay it later. Two halves of the same protocol.

## The protocol, in one diagram

```
Composer.send(text)
       │
       ▼
useSendMessage.mutate({ text, model })
       │
       │── optimistic insert HumanMessage + AI stub into useChatStore
       │
       ▼
POST /conversations/:conv/messages { content: text, model? }
       │
       │── 202 { human_message_id, run_id }   (returns fast; agent runs in background)
       │
       ▼
EventSource(/events/:run_id)
       │
       ├─ event: ai_message      { id, content, tool_calls?, model, latency_ms, tokens }
       ├─ event: tool_call       { id, message_id, name, args, started_at }
       ├─ event: tool_result     { tool_call_id, content, latency_ms }
       ├─ event: cursor          { node_id, depth, visited_ids }
       ├─ event: error           { tool_call_id?, message }
       ├─ event: final           { ai_message_id, content, stop_reason }
       └─ event: done            { totals }
       │
       ▼
useRunsStore reduces events → runs[run_id] grows step-by-step
useChatStore reconciles ids; ChatPanel re-renders
TracePanel re-renders from the same run
TreeCanvas overlay follows cursor events
```

Six event kinds. No more. Adding a seventh requires writing it in this doc and in `lib/eventSource.ts`'s dispatch table.

## Events — exhaustive

The shapes below are what the frontend consumes. Each event matches a row that the backend persists during the run.

### `ai_message`

The agent produced a turn. Either a thinking step (with `tool_calls` and empty `content`) or the final answer (with `content` and empty `tool_calls`). Always carries a stable `id` (the eventual `Message.id`).

```json
{
  "type": "ai_message",
  "run_id": "01H...",
  "id": "msg-ai-01",
  "content": "",
  "tool_calls": [
    { "id": "tc-1", "name": "goto_child", "args": { "child_id": "cs.languages" } }
  ],
  "model": "gpt-4.1-mini",
  "latency_ms": 380,
  "input_tokens": 412,
  "output_tokens": 58,
  "seq": 1,
  "ts": "2026-05-30T10:01:00.380Z"
}
```

### `tool_call`

Optional event — fired the moment the agent *begins* executing a tool. Useful for "spider walking…" indicator. The frontend may skip it if the tool is so fast that only the result event matters.

```json
{
  "type": "tool_call",
  "run_id": "01H...",
  "id": "tc-1",
  "message_id": "msg-ai-01",
  "name": "goto_child",
  "args": { "child_id": "cs.languages" },
  "started_at": "2026-05-30T10:01:00.381Z"
}
```

### `tool_result`

The result of a tool call. Becomes a `ToolMessage` row on the server.

```json
{
  "type": "tool_result",
  "run_id": "01H...",
  "id": "msg-tool-01",
  "tool_call_id": "tc-1",
  "tool_name": "goto_child",
  "content": "{\"ok\":true,\"cursor\":\"cs.languages\",\"children\":[\"python\",\"rust\"]}",
  "latency_ms": 2,
  "seq": 2,
  "ts": "2026-05-30T10:01:00.383Z"
}
```

### `cursor`

The spider moved. Pure visualization signal — the tree overlay reads this to animate the cursor. Idempotent (same `node_id` may repeat after a no-op tool).

```json
{
  "type": "cursor",
  "run_id": "01H...",
  "node_id": "cs.languages",
  "depth": 1,
  "visited_ids": ["cs", "cs.languages"],
  "ts": "2026-05-30T10:01:00.384Z"
}
```

### `error`

A tool failed, or the agent hit an unrecoverable condition. May or may not carry `tool_call_id`.

```json
{
  "type": "error",
  "run_id": "01H...",
  "tool_call_id": "tc-1",
  "message": "Node 'cs.lingoes' not found",
  "ts": "..."
}
```

### `final`

The agent emitted `answer()`. The last `ai_message` carries the markdown answer. `final` confirms termination and stop reason.

```json
{
  "type": "final",
  "run_id": "01H...",
  "ai_message_id": "msg-ai-04",
  "content": "## Python's asyncio Event Loop\n\n…",
  "stop_reason": "answer",
  "ts": "..."
}
```

### `done`

The stream is closing. The frontend should `EventSource.close()` and rely on the React Query `qk.run(run_id)` cache to render replays from here on.

```json
{
  "type": "done",
  "run_id": "01H...",
  "totals": {
    "ai_messages": 4,
    "tool_calls": 3,
    "total_latency_ms": 1340,
    "input_tokens": 1762,
    "output_tokens": 380
  },
  "ts": "..."
}
```

## Reduction — events to state

One file owns the reducer: `features/trace/lib/reduceEvents.ts`. It is **pure** — given a `LiveRun` and an `Event`, it returns the next `LiveRun`. No React, no stores, fully unit-testable.

```ts
export function reduceEvent(run: LiveRun, ev: Event): LiveRun {
  switch (ev.type) {
    case 'ai_message':  return { ...run, messages: [...run.messages, asAi(ev)] };
    case 'tool_call':   return { ...run, pendingTool: ev };
    case 'tool_result': return { ...run, messages: [...run.messages, asTool(ev)], pendingTool: null };
    case 'cursor':      return { ...run, cursor_id: ev.node_id, visited_ids: ev.visited_ids };
    case 'error':       return { ...run, status: 'error', errorMessage: ev.message };
    case 'final':       return { ...run, status: 'completed', final_answer: ev.content, stop_reason: ev.stop_reason };
    case 'done':        return run;
  }
}
```

`useRunsStore.appendEvent(run_id, ev)` is the only place that calls this reducer. Components subscribe to slices of `runs[run_id]` and re-render when the slice changes.

## EventSource lifecycle

Owned by `playground/lib/eventSource.ts`:

```ts
interface RunSubscription {
  runId: string;
  source: EventSource;
  close: () => void;
}

export function subscribeRun(runId: string, dispatch: (ev: Event) => void): RunSubscription {
  const source = new EventSource(`${API}/events/${runId}`);
  for (const name of EVENT_NAMES) {
    source.addEventListener(name, (e) => dispatch(JSON.parse(e.data)));
  }
  source.onerror = () => /* backoff + reconnect; cap retries */;
  return { runId, source, close: () => source.close() };
}
```

Rules:

- **One subscription per `run_id`**, tracked in `useRunsStore.sources[run_id]`.
- **Multiple concurrent runs are allowed** — opening a second message while one is in flight opens a second EventSource.
- **Reconnect with backoff** (`1s, 2s, 4s, 8s, 16s, give up`). On reconnect, request server-side replay buffer (see [05-api/02-sse-streaming.md](../../05-api/02-sse-streaming.md)) so the trace doesn't gap.
- **Cleanup hooks**: switching conversation closes sources for runs whose `conversation_id` no longer matches. Switching tree closes everything.

## Cancellation

A user can cancel an in-flight run from the chat:

```
POST /runs/:run_id/cancel
  → 200 { status: 'cancelled' }
```

The server marks the run cancelled; the agent loop exits at the next safe point (between tool calls). The SSE stream sends one `error` with `message: 'cancelled'` and then `done`. The frontend updates the AI stub's status to `'cancelled'` and shows a dismissable banner.

## Replay — picking a past message

When the user clicks "Show reasoning" on a past AI message (or lands on `?msg=<id>`), the playground needs the run's full state. It is **not** in the live store — it lives on the server.

```
useRun(run_id)                                   ← React Query
   │
   ├── cache hit:  render trace from cached AgentState
   └── miss:       GET /runs/:id → { AgentState } → cache → render
```

`AgentState` is the same shape the live reducer produces, just complete. No re-execution; no re-stream. Deterministic.

## Concurrency

Multiple runs may be live at once (the user sends a second message while the first is still routing). The frontend handles this by:

- Storing each live run independently in `useRunsStore.runs[run_id]`.
- Subscribing each to its own EventSource.
- Rendering the chat panel with both AI stubs marked "live".
- Rendering the trace panel with the **target** run (`useUiStore.debugTarget`), not the latest.

Cancellation is per-run.

## Replay buffer & late subscribers

A user opens a deep link to a conversation where a run is still in flight. The frontend mounts, sees the AI message status is `pending` or `streaming`, and opens an EventSource to its `run_id`. The server replays events from the start of the run (capped buffer; see [05-api/02-sse-streaming.md](../../05-api/02-sse-streaming.md)) so the late-joining client doesn't miss the early steps.

This is what makes the URL-as-state property hold even for in-flight runs.

## What the chat panel does on each event

A compact map. The full visual is in [06-chat-history.md](./06-chat-history.md).

| Event | ChatPanel effect | TracePanel effect | TreeCanvas effect |
|---|---|---|---|
| `ai_message` (tool_calls) | "spider walking…" strip grows | new AI card | — |
| `tool_call` | small live indicator | grays out result row | — |
| `tool_result` | strip entry shows latency | result fills in | — |
| `cursor` | — | cursor metadata bumps | node pulses, overlay updates |
| `error` | error chip on the live turn | error card | last visited node gets rose ring |
| `final` | strip collapses, final markdown appears | answer card | final cursor highlighted |
| `done` | stream-end checkmark | totals row | — |

## Where the agent code lives (backend reminder)

Frontend doesn't touch these, but knowing what's on the other side helps debug:

- `backend/sace/agent/tools.py` — the toolset (the spider's verbs).
- `backend/sace/agent/graph.py` — LangGraph compilation.
- `backend/sace/agent/router_node.py` — produces an `ai_message` with `tool_calls`.
- `backend/sace/agent/visit_node.py` — executes tools, emits `tool_call` + `tool_result` + `cursor`.
- `backend/sace/agent/answer_node.py` — produces the final `ai_message` and `final`.
- `backend/sace/events/emit.py` — the only place that calls `bus.publish(run_id, event)`.

If an event isn't reaching the browser, the chain is: `emit.py` → `EventBus` → `routes/events.py` SSE handler → `lib/eventSource.ts` → reducer → store. Walk it from either end.

## What the agent does **not** decide

- **Which model.** That's passed in by `POST /messages`; the agent reads it from state.
- **Which tree.** Same — comes from the conversation row.
- **The starting cursor.** Server initializes the cursor at the tree root for every new run. The spider always starts at root, even mid-conversation. (A future "resume from last cursor" is reserved; not in v1.5.)
- **Whether to persist.** Persistence is automatic — every event the agent emits is also a row insert.

## Hardening for the future (v2 slots)

| Slot | What it adds | Why deferred |
|---|---|---|
| `tool_streaming` event | Per-token streaming of AI thinking | Mini models are fast enough that turn-level streaming suffices |
| `compare` URL param | Open two trace panels side by side for diff | Adds a column and a renderer; ~v2 |
| Resume cursor | Subsequent runs in a conversation start from prior cursor | Needs UX decision: confusing across topics |
| Multi-tree tool calls | `goto_other_tree(tree_id, node_id)` | Out of scope until use-case appears |
| Budget caps | Max tool calls / max tokens per run | Trivial to add server-side; one config |

Each is a one-event or one-field change. The protocol is designed to grow without rewrites.

## Frontend acceptance for "agent is wired"

The four things that prove the integration works end-to-end:

1. User sends a message. Within < 200 ms the user bubble appears and a live AI placeholder shows "spider walking…".
2. Each `tool_call` adds a row to the placeholder's strip; the tree canvas highlights the moving cursor.
3. `final` arrives, the strip collapses, the markdown answer renders, the "Show reasoning" link enables.
4. Refresh the page. The exact same conversation renders from the server, and clicking "Show reasoning" loads the full trace from `GET /runs/:id` — no re-stream.

When all four work, the agent is wired. Everything in this doc exists to make those four work.
