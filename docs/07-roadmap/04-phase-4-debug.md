# Phase 4 — Live debug & dual-view fidelity

**Goal:** Replace polling with SSE. The agent's walk streams live across **both** debug views — inline in the chat bubble (Cursor-style: thinking, steps, answer) and on the tree (animated edges, current cursor, step badges). The message selector switches debug targets without interrupting other live runs. Replay scrubbing works for any past message. This is the playground at full intended fidelity — the GPS-history experience.

**Done when:** in the browser:
1. You ask a question; the assistant bubble fills in thinking → steps → answer as the LLM works, and the tree animates the route at the same time.
2. You send a second question while the first is still streaming; both bubbles stream concurrently.
3. You click an old assistant message and the tree overlay + debug panel snap to that message's trip, leaving the live ones running.
4. You scrub backwards through a completed trip and the tree-overlay reflects partial state at each step.

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

### 4.6 Live wiring — per run
- `useLiveRun(run_id)` hook subscribes to SSE and applies events to `traceStore.runs[run_id]`.
- App keeps an open subscription per in-flight `run_id` (or one multiplexed conn to `/conversations/{cid}/stream`).
- `traceStore` reducers for each event name (`start`, `step_start`, `thinking_delta`, `tool_call`, `step`, `visit`, `answer_start`, `answer_token`, `final`, `error`, `done`).
- Tree-overlay: edge animation on `visit`; step badge upsert on `step`; pulse on current cursor.
- Concurrent live runs supported (multiple subscriptions, no shared mutable state).

### 4.7 Inline streaming in the chat bubble
- `AssistantMessage` renders `ThinkingFoldout`, `StepsFoldout`, `AnswerFoldout` driven by `traceStore.runs[run_id]`.
- Thinking and step decisions arrive as events fire; answer markdown streams with `answer_token` chunks throttled at ~20fps.
- Meta bar finalizes on `done`.

### 4.8 Replay — derived from saved state
- `traceStore.replayIndex` (per-target).
- Selectors `cursorIdAt(i)`, `visitedIdsAt(i)`, `stepAt(i)`.
- Debug panel scrubber for completed runs.
- Live/replay transition is seamless: a completed run's panel just gains a scrubber, no mode flip.

### 4.9 Message selector + debug-target pinning
- Dropdown in the debug panel + top bar listing assistant messages.
- `uiStore.debugTarget` + `uiStore.debugTargetIsPinned`.
- Behavior: live runs auto-follow until pinned; pinned target survives new runs starting.
- Keyboard shortcuts (`⌘[`, `⌘]`, `⌘0`).
- Clicking an assistant message bubble sets the target.

### 4.10 Cancellation
- `POST /runs/{id}/cancel` endpoint.
- Cancel button on the in-flight assistant message in chat.
- Graph nodes check the cancellation event between LLM calls.
- Cancelled run's partial trace remains debuggable.

### 4.11 Tests
- `tests/integration/test_sse.py` — start a run, subscribe, assert event sequence shape (including `step_start` / `thinking_delta` / `step` ordering per step).
- `tests/integration/test_concurrent_runs.py` — two runs in flight, two SSE streams, no cross-talk.
- Frontend: a Vitest test that feeds a mocked `EventSource` and asserts the per-run `traceStore` state.
- Frontend: a test that toggles `debugTarget` between two completed runs and asserts the overlay selectors switch.

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
