# Agent wiring

> **Status — future, marked v1.5 unless tagged otherwise.** Today `useSendMessage` is a 600 ms timeout that appends a fake assistant reply. This doc describes how it lights up once the LangGraph agent ships. The frontend can be built ahead of the backend — every contract here is the seam between them.

The design rule from [06-chat-history.md](./06-chat-history.md) applies: **we forward LangGraph's native stream; we don't invent new shapes.** What the agent emits is what the frontend consumes. The backend's job is to be a thin proxy from LangGraph's async iterators to an SSE stream.

## The protocol, in one diagram

```
Composer.send(text)
       │
       ▼
useSendMessage.mutate({ text, model })
       │
       │── optimistic insert HumanMessage row into useChatStore
       │
       ▼
POST /conversations/:conv/messages { content: text, model? }
       │
       │── 202 { human_message_id, run_id, thread_id }
       │
       ▼
EventSource(/runs/:run_id/stream)
       │
       │   Server-side, per request:
       │     async for chunk in graph.astream(
       │         {"messages": [HumanMessage(content=text)]},
       │         config={"configurable": {"thread_id": thread_id}},
       │         stream_mode=["messages", "updates", "values"],
       │     ):
       │         await sse.send(chunk)
       │
       ├─ event: messages   ← (AIMessageChunk | ToolMessage, metadata) tuple
       ├─ event: updates    ← { node_name: state_delta }
       ├─ event: values     ← full state snapshot (sent sparingly; on key transitions)
       ├─ event: error      ← { run_id, message }
       └─ event: done       ← { run_id, status }
       │
       ▼
useRunsStore reduces events → runs[run_id] grows
useChatStore reconciles ids; ChatPanel re-renders
TracePanel re-renders from the same run
TreeCanvas overlay follows cursor inferred from tool_calls
```

**Three event kinds from LangGraph + two from us.** Adding more is rare — LangGraph's streams already cover the use case.

## Why forward LangGraph's stream, not invent one

LangGraph's `graph.astream(stream_mode=…)` already gives us three useful views:

| `stream_mode` | Yields | Use it for |
|---|---|---|
| `"messages"` | `(message_chunk, metadata)` tuples for each LLM token | Live AIMessageChunk accumulation in the chat panel; live tool-call args streaming |
| `"updates"` | `{ node_name: state_delta }` after each node finishes | Trace panel cards ("router fired", "visit fired"), cursor updates |
| `"values"` | full state snapshot after each node | Replay-friendly; sent on key transitions for late subscribers |

If we invented `ai_message` / `tool_call` / `tool_result` events, we'd have to translate `AIMessageChunk` → our shape on the server, then back on the client, then forget to update when LangChain adds a field. Forwarding the chunks verbatim removes both halves of the work.

The server's SSE endpoint is ~30 lines:

```python
@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str, bus: EventBus = Depends(get_event_bus)):
    queue = bus.subscribe(run_id)

    async def gen():
        try:
            while True:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                if event is None:                                   # sentinel: done
                    yield {"event": "done", "data": json.dumps({"run_id": run_id, "status": "completed"})}
                    return
                yield {"event": event["mode"], "data": json.dumps(event["chunk"], default=_lc_default)}
        finally:
            bus.unsubscribe(run_id, queue)

    return EventSourceResponse(gen())
```

The agent invocation pushes onto the bus:

```python
async def run_agent(run_id: str, thread_id: str, human_msg: HumanMessage, bus: EventBus):
    config = {"configurable": {"thread_id": thread_id}}
    async for mode, chunk in graph.astream(
        {"messages": [human_msg]},
        config=config,
        stream_mode=["messages", "updates", "values"],
    ):
        await bus.publish(run_id, {"mode": mode, "chunk": chunk})
    await bus.publish(run_id, None)   # sentinel
```

That's the protocol. Everything below is the frontend side.

## Event payload shapes

The frontend receives `(mode, chunk)` per SSE event where `mode` is `"messages"`, `"updates"`, or `"values"`.

### `messages` events

LangGraph emits `(message_chunk, metadata)` tuples. Serialized to JSON:

```json
{
  "chunk": {
    "type": "AIMessageChunk",
    "content": " Python",
    "id": "run--abc-...",
    "tool_call_chunks": [
      { "name": "goto_child", "args": "{\"chi", "id": "tc-1", "index": 0, "type": "tool_call_chunk" }
    ],
    "additional_kwargs": {},
    "response_metadata": {}
  },
  "metadata": {
    "thread_id": "01H...",
    "langgraph_node": "router",
    "langgraph_step": 1,
    "ls_model_name": "gpt-4.1-mini",
    "ls_provider": "openai",
    "ls_temperature": 0.2
  }
}
```

Two important properties:

- **Chunks concatenate.** Multiple `AIMessageChunk` events for one final message arrive in order; `content` strings concatenate, `tool_call_chunks[index].args` strings concatenate (they're partial JSON), and `id` stays the same. LangChain provides `__add__` on `AIMessageChunk` for this — or use the pure helper below.
- **Tool messages arrive whole.** `ToolMessage` is not chunked. When a tool runs, the entire `ToolMessage` arrives in one `messages` event.

```json
{
  "chunk": {
    "type": "ToolMessage",
    "tool_call_id": "tc-1",
    "name": "goto_child",
    "content": "{\"ok\":true,\"cursor\":\"cs.languages\",...}",
    "status": "success"
  },
  "metadata": { "langgraph_node": "tools", "langgraph_step": 2 }
}
```

### `updates` events

After each node finishes, LangGraph emits its return value keyed by node name:

```json
{
  "router": {
    "messages": [ /* the AIMessage just produced */ ]
  }
}
```

The frontend uses these to anchor trace cards ("router ran at step 1") and to know when to snapshot the cursor. The trace panel doesn't need them for correctness — the messages alone are enough — but they're useful for "which graph node produced which message" annotations.

### `values` events

Full state snapshot after each node. Heavy; sent only on key transitions (configurable per-graph). The frontend uses these for **catching up a late subscriber**: when the user opens the playground on a URL whose run is mid-flight, the first `values` event is enough to render the trace from the beginning.

### `done`

Our own event. Marks stream end.

```json
{ "run_id": "01H...", "status": "completed" }
```

The frontend `EventSource.close()`s and switches to the React Query cache for `qk.run(runId)` for any further reads.

### `error`

Our own event. Wraps `GraphRecursionError`, tool exceptions that escape the agent, transport errors:

```json
{ "run_id": "01H...", "message": "Recursion limit reached" }
```

## Reduction — events to state

One file owns the chunk reducer: `features/chat/lib/accumulateChunk.ts`. Pure — given a partial `AIMessage` and an `AIMessageChunk`, returns the next partial. No React, no stores. Mirrors LangChain's `AIMessageChunk.__add__`.

```ts
export function accumulateChunk(
  acc: AIMessageInProgress | null,
  chunk: AIMessageChunk,
): AIMessageInProgress {
  if (!acc) return chunkToInProgress(chunk);
  return {
    ...acc,
    id: acc.id ?? chunk.id,
    content: (acc.content as string) + (chunk.content as string),
    tool_call_chunks: mergeToolCallChunks(acc.tool_call_chunks, chunk.tool_call_chunks),
    additional_kwargs: { ...acc.additional_kwargs, ...chunk.additional_kwargs },
    response_metadata: { ...acc.response_metadata, ...chunk.response_metadata },
  };
}

export function finalizeChunks(p: AIMessageInProgress): AIMessage {
  return {
    type: 'ai',
    id: p.id,
    content: p.content,
    tool_calls: parseToolCallChunks(p.tool_call_chunks),   // partial-JSON → ToolCall[]
    additional_kwargs: p.additional_kwargs,
    response_metadata: p.response_metadata,
  };
}
```

`useRunsStore.appendMessagesEvent(run_id, chunk)` is the only thing that calls this reducer. Components subscribe to slices of `runs[run_id]` and re-render when the slice changes.

For `ToolMessage` chunks (which arrive whole), the same store action appends them directly — no accumulation needed.

## EventSource lifecycle

Owned by `playground/lib/eventSource.ts`:

```ts
interface RunSubscription {
  runId: string;
  source: EventSource;
  close: () => void;
}

export function subscribeRun(runId: string, dispatch: (mode: string, chunk: unknown) => void): RunSubscription {
  const source = new EventSource(`${API}/runs/${runId}/stream`);
  for (const mode of ['messages', 'updates', 'values', 'error', 'done'] as const) {
    source.addEventListener(mode, (e) => dispatch(mode, JSON.parse(e.data)));
  }
  source.onerror = () => /* backoff + reconnect; cap retries */;
  return { runId, source, close: () => source.close() };
}
```

Rules:

- **One subscription per `run_id`**, tracked in `useRunsStore.sources[run_id]`.
- **Multiple concurrent runs are allowed** — opening a second message while one is in flight opens a second EventSource.
- **Reconnect with backoff** (`1s, 2s, 4s, 8s, 16s, give up`). On reconnect, request the latest `values` snapshot from the server (a `?from=values` query param the SSE handler honors) so the trace doesn't gap.
- **Cleanup hooks**: switching conversation closes sources for runs whose `conversation_id` no longer matches. Switching tree closes everything.

## Cancellation

A user can cancel an in-flight run from the chat:

```
POST /runs/:run_id/cancel
  → 200 { status: 'cancelled' }
```

Server marks the run cancelled; the agent loop exits at the next checkpoint boundary (between nodes — LangGraph checkpoints make this safe). The SSE stream sends one `error` with `message: 'cancelled'` and then `done`. The frontend updates the AI turn's `delivery_status` to `cancelled` and shows a dismissable banner.

## Replay — picking a past message

When the user clicks "Show reasoning" on a past AI message (or lands on `?msg=<id>`), the playground needs the run's full state. It is **not** in the live store — it lives on the server.

```
useRun(run_id)                                   ← React Query
   │
   ├── cache hit:  render trace from cached Run
   └── miss:       GET /runs/:id → { Run } → cache → render
```

`Run.checkpoint` is the LangGraph snapshot dumped by `graph.get_state(config).values`. It contains the full `messages: list[BaseMessage]` for the run. The trace panel renders from `checkpoint.messages` and the message rows; no re-execution.

For deeper inspection (the whole history at every step), the server can also expose `GET /runs/:id/history` which proxies `graph.get_state_history(config)` — yielding every checkpoint the run went through. **Future, not v1.5.** Useful when the agent is doing genuine time-travel debugging.

## Concurrency

Multiple runs may be live at once. The frontend handles this by:

- Storing each live run independently in `useRunsStore.runs[run_id]`.
- Subscribing each to its own EventSource.
- Rendering the chat panel with both AI turns marked "live".
- Rendering the trace panel with the **target** run (`useUiStore.debugTarget`), not the latest.

Cancellation is per-run. Reconnect is per-run.

## Cursor inference

The tree canvas needs to know which node the spider is on. Two sources, in priority order:

1. **The most recent `ToolMessage` content** — every `goto_*` tool returns `{ cursor: "<node_id>", ... }`. Parse `payload.content` (JSON), read `.cursor`. This is the authoritative source.
2. **`updates` events from the `visit` node** — emits the new cursor as part of its state delta.

The frontend prefers (1). (2) is a backup for graphs where the tool result format isn't standardized.

Both are derived from the messages — no separate `cursor` event needed. Removing the invented `cursor` event drops one more thing to maintain.

## What the chat panel does on each event

| Event mode | ChatPanel effect | TracePanel effect | TreeCanvas effect |
|---|---|---|---|
| `messages` (AIMessageChunk, content) | accumulate into live turn's content | accumulate into live AI card | — |
| `messages` (AIMessageChunk, tool_call_chunks) | accumulate into live turn's tool strip | accumulate into live AI card's tool_calls | — |
| `messages` (ToolMessage) | strip entry shows status/latency | result fills in | parse `cursor` → highlight node |
| `updates` (router/visit/answer) | — | annotate cards with `langgraph_node` | — |
| `values` | — | reconcile partial state with snapshot | reconcile visited set |
| `error` | error chip on the live turn | error card | last visited node gets rose ring |
| `done` | finalize live turn → AIMessage; collapse strip | totals row; mark completed | — |

## Where the agent code lives (backend reminder)

Frontend doesn't touch these, but knowing what's on the other side helps debug:

- `backend/sace/agent/tools.py` — `@tool`-decorated functions (the spider's verbs).
- `backend/sace/agent/graph.py` — `StateGraph.compile(checkpointer=…)`.
- `backend/sace/agent/runner.py` — the `astream` loop that publishes to the bus.
- `backend/sace/events/bus.py` — in-memory per-run queue.
- `backend/sace/api/routes/runs.py` — `/runs/:id/stream` SSE handler that forwards bus events.

If a chunk isn't reaching the browser, the chain is: `graph.astream` → `bus.publish` → SSE handler → `lib/eventSource.ts` → reducer → store. Walk it from either end.

## LangGraph checkpointers (Run.checkpoint storage)

The recommended setup:

- **Dev**: `langgraph.checkpoint.sqlite.SqliteSaver` — same SQLite file as the rest of the app, no extra service.
- **Prod**: `langgraph.checkpoint.postgres.AsyncPostgresSaver` — same Postgres as the rest of the schema.

Both store checkpoints keyed by `thread_id`. Our `Run.thread_id` column is what makes that connection. `Run.checkpoint` is a *frozen copy* taken at `done` time (`graph.get_state(config).values`) so that:

- Replays render from `Run.checkpoint` directly — no checkpointer call needed.
- Garbage-collecting old checkpointer entries (a future cron) doesn't break replay.

Tradeoff: `Run.checkpoint` duplicates data the checkpointer also has, until GC. That's deliberate — the checkpointer is for *live* graph state; the Run row is for *frozen* replay.

## What the agent does **not** decide

- **Which model.** Passed in via `POST /messages`; the agent reads it from `config.configurable.model` (or a state field).
- **Which tree.** Same — comes from the conversation row.
- **The starting cursor.** Server initializes the cursor at the tree root for every new run. The spider always starts at root, even mid-conversation. (Resume-from-cursor is a v2 slot.)
- **Whether to persist.** Persistence is automatic — every chunk the agent emits is also serialized into the bus and the checkpointer.

## Hardening for the future (v2 slots)

| Slot | What it adds | Why deferred |
|---|---|---|
| `?compare=<run_id>` URL param | Open two trace panels side-by-side for diff | Adds a column and a renderer; ~v2 |
| `GET /runs/:id/history` | Full checkpoint history endpoint (time-travel) | LangGraph supports it; UI absent |
| Resume cursor | Subsequent runs in a conversation start from prior cursor | UX decision: confusing across topics |
| Budget caps | Max tool calls / max tokens per run | One config; trivial to add |
| Multi-tree tool calls | `goto_other_tree(tree_id, node_id)` | Out of scope until use-case appears |

Each is a one-event or one-field change. The protocol is designed to grow without rewrites.

## Frontend acceptance for "agent is wired"

Four checks prove the integration works end-to-end:

1. User sends a message. Within < 200 ms the user bubble appears and a live AI placeholder shows "spider walking…".
2. Each `messages`-mode `AIMessageChunk` extends the placeholder's strip; each `ToolMessage` chunk parses `cursor` and animates the tree canvas.
3. The final `AIMessageChunk` (content non-empty, tool_calls empty) finalizes via `finalizeChunks`, the strip collapses, the "Show reasoning" link enables.
4. Refresh the page. The conversation re-renders from the server, and clicking "Show reasoning" loads the trace from `GET /runs/:id` — no re-stream, identical render.

When all four work, the agent is wired. Everything in this doc exists to make those four work.
