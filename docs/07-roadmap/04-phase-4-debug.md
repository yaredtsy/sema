# Phase 4 — Debug & live trace

**Goal:** Replace polling with SSE. The UI shows the agent's walk *as it happens* — cursor moves, edges animate, step cards stream in. Replay mode works. This is the playground at its full intended fidelity.

**Done when:** you submit a question and watch the agent walk the tree in real time, with each step card appearing as the LLM responds, and you can scrub backward through the trace.

## Tasks

### 4.1 Event bus (backend)
- `backend/sace/events/bus.py` — per-`run_id` queue with bounded replay buffer (last 1000 events).
- `subscribe(run_id) → async iterator`.
- `publish(run_id, event)`.
- `replay(run_id, after_seq) → iterator over buffered events with seq > after_seq`.
- Cleans up event buffers when a run is fully done + last subscriber disconnects (or after a 30-min TTL).

### 4.2 Event emission from the graph
- `backend/sace/events/emit.py` — helpers `emit_start`, `emit_step`, `emit_visit`, `emit_answer_start`, `emit_answer_token`, `emit_final`, `emit_error`, `emit_done`.
- Each helper builds the Pydantic event, assigns `seq`, pushes onto the bus.
- Plumb the bus + `run_id` into the LangGraph state (or as a closure on the graph nodes).

### 4.3 SSE endpoint
- `backend/sace/api/routes/events.py` — `GET /events/{run_id}` using `sse-starlette.EventSourceResponse`.
- Respect `Last-Event-ID` header on reconnect — replay missed events first, then live.
- 15-second keepalive ping.
- Drop subscriber if its queue overflows.

### 4.4 Streaming answer (optional within Phase 4)
- Use `langchain_openai`'s streaming mode for the answer call.
- Emit `answer_token` events.
- On the frontend, render incrementally.

If streaming complicates the parsing for the *router* step, we leave router calls non-streamed (parse needs the full block) and only stream the answer.

### 4.5 Frontend SSE client
- `frontend/src/api/events.ts` — `subscribeEvents(run_id, onEvent)` wrapping `EventSource`.
- Auto-reconnect with `Last-Event-ID`.
- Returns an `unsubscribe` function.

### 4.6 Live wiring
- `useLiveTrace(run_id)` hook in `App.tsx`.
- Remove the polling from Phase 3.
- `traceStore` reducers for each event name.
- Edge animation in React Flow on `visit`.
- "Considered" siblings highlight on `step`, fade after 1.5s.

### 4.7 Live status row in chat
- `LiveStatusRow.tsx` reading the latest step + cursor from `traceStore`.
- Switches to the final markdown answer when `final` arrives.

### 4.8 Replay mode
- `traceStore.replayIndex` (number | null).
- Selectors `cursorIdAt(i)`, `visitedIdsAt(i)`.
- Components read from selectors when `replayIndex != null`.
- Trace panel scrubber + Live/Replay toggle.

### 4.9 Cancellation
- `POST /runs/{id}/cancel` endpoint.
- Cancel button on the in-flight assistant message in chat.
- Graph nodes check the cancellation event between LLM calls.

### 4.10 Tests
- `tests/integration/test_sse.py` — start a run, subscribe, assert event sequence shape.
- Frontend: a Vitest test that feeds a mocked `EventSource` and asserts the trace store state.

## Out of scope for Phase 4

- Diff mode (run-vs-run comparison)
- A node editor in the UI
- Multi-turn chat
- Persistent run history
- Beam search / look-ahead variants

These all have natural slots already (see [03-agent/05-tools-and-decisions.md](../03-agent/05-tools-and-decisions.md) and [06-frontend/04-live-trace.md](../06-frontend/04-live-trace.md)) but earn their way in.

## Risks

- **Proxy buffering.** Some dev proxies (or browsers in `http://localhost` quirks) buffer SSE. Test with `curl -N` to isolate before blaming the code.
- **Event ordering on reconnect.** Easy to off-by-one the `Last-Event-ID` replay. Write a deliberate disconnect test.
- **State updates causing tree-viz re-layout.** Only animate; never re-layout on agent events. Bug catches itself if positions jump.

## Time estimate

Three to five focused days. The SSE plumbing is the slow part; replay mode is a half-day once the store is shaped right.

## After Phase 4

We have a complete playground. Next directions, *in priority order if we choose to continue*:

1. **Evaluation harness with golden traces.** Make prompt tweaks falsifiable.
2. **Beam-2 ablation.** Measure the accuracy gain vs. cost.
3. **Multi-tree query routing.** "Which tree does this query belong to?" as a 0th step.
4. **Tree authoring UI.** Only after we know what queries break the current trees.
5. **A small write-up of findings.** Even a negative result is publishable.

Each becomes its own roadmap doc when its time arrives.
