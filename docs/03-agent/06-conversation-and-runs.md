# Conversation & runs

How a multi-turn conversation maps onto LangGraph runs, and how that mapping makes the GPS-history debugger possible.

## The mental model

```
Conversation
├── Message [user]      "How does asyncio work?"
├── Message [assistant] ─── Run R1 ─── AgentState (trace, cursors, answer)
├── Message [user]      "And what about gather() specifically?"
├── Message [assistant] ─── Run R2 ─── AgentState (trace, cursors, answer)
├── Message [user]      "Compare to threading."
└── Message [assistant] ─── Run R3 ─── AgentState (...)  ← currently streaming
```

The conversation is a list of messages. Each assistant message points to exactly one run. Each run is a complete, replayable record.

## ConversationManager

A small server-side object in `backend/sace/api/conversation_manager.py`:

```python
class ConversationManager:
    def __init__(self, store: TreeStore, registry: RunRegistry, bus: EventBus): ...

    def create(self, tree_id: str) -> Conversation: ...
    def get(self, conversation_id: str) -> Conversation: ...
    def export(self, conversation_id: str) -> dict: ...     # conversation + all referenced AgentStates

    async def post_message(
        self,
        conversation_id: str,
        text: str,
        model: str | None = None,
        policy: TraversalPolicy | None = None,
    ) -> tuple[Message, Message]:
        """Append a user message, create an assistant stub + run, kick off the run.
        Returns (user_message, assistant_message). The assistant message has run_id set."""
        ...
```

It is the only place that knows how messages and runs are paired. The agent code never touches `Conversation`; it only sees `AgentState`.

## Sequence — submitting a message

```
HTTP                      ConversationManager          RunRegistry         AgentGraph     EventBus
 │                                │                          │                  │             │
 │ POST /conversations/{cid}/    │                          │                  │             │
 │      messages {text}           │                          │                  │             │
 │ ─────────────────────────────▶ │                          │                  │             │
 │                                │ append user_msg          │                  │             │
 │                                │ assistant_msg = stub(run_id=R, status=pending)            │
 │                                │ start_run(R)             │                  │             │
 │                                │ ────────────────────────▶│                  │             │
 │                                │                          │ track R          │             │
 │                                │                          │ schedule task ──▶│             │
 │                                │                          │                  │ invoke graph│
 │                                │                          │                  │             │ emit start
 │  202 {message_id, run_id,      │                          │                  │             │
 │       events_url}              │                          │                  │             │
 │ ◀───────────────────────────── │                          │                  │             │
 │ (open SSE to events_url)       │                          │                  │             │
 │                                │                          │                  │             │ emit step…
```

The HTTP response returns quickly with the new `message_id` and `run_id`. The agent runs in a background task. Events stream on the SSE channel for `run_id`.

## Why this scopes debugging cleanly

When the user picks a message in the chat to debug:

```ts
selectMessageForDebug(messageId) {
  const msg = conversation.messages.find(m => m.id === messageId);
  if (!msg?.run_id) return;             // user messages have no run
  uiStore.setDebugTarget(msg.run_id);
  // → triggers the debug panel + tree-overlay view to fetch /runs/{run_id}
  //   and project both views from that AgentState
}
```

There is no slicing. There is no "which steps belong to message 3?" question. The run id IS the debug target.

## Multi-run concurrency

The user *can* send two messages in quick succession. We support it:

- Each `POST /messages` spawns a new run; they execute concurrently.
- Each has its own SSE channel and its own `AgentState`.
- The frontend opens one SSE per active run. Both progress; the chat panel shows both assistant messages streaming.

We do **not** lock the chat to "wait for previous". A reasonable use case is "ask 5 variations and compare the traces". The data model and event scope already make this safe.

A guardrail: the frontend warns if there are > 3 concurrent runs (you'll just exhaust your token budget). Soft cap.

## Cancellation

`POST /api/v1/runs/{run_id}/cancel` sets a cancellation event on the run. The agent loop checks between LLM calls and exits cleanly. The associated message moves to status `cancelled`; the partial trace is preserved.

A cancelled run is still debuggable. Replays show the partial walk and the cancellation marker.

## Persistence boundary

- **In-memory**: `conversations`, `runs`. Fast.
- **Export**: `POST /api/v1/conversations/{cid}/export` returns the full conversation + all referenced `AgentState`s as one JSON. Save to disk manually (or via the UI's "Export" button).
- **Import**: `POST /api/v1/conversations/import` accepts that JSON and rehydrates both maps.

Real persistence (SQLite) is a Phase 5+ concern.

## What about prior turns in the prompt?

A separate, optional concern. The router prompt does NOT include prior turns in v1. The agent treats each message as fresh — starts at the root every time.

The `ConversationManager` can pass `prior_messages: list[Message]` into the `AgentState` later, and `prompts/router_prompt.py` can be taught to include a "previous conversation" section. We are not building this now; the slot is reserved. Document as an experiment when shipped.

The case for *not* using prior turns by default: routing is a local decision based on the tree topology. Prior turns are noise for that decision. The case *for*: ambiguous follow-up queries ("and the other one?") cannot be routed without context. We'll know which case dominates after a few hundred queries.

## Failure modes the manager handles

| Failure | Behavior |
|---|---|
| `tree_id` not found at message-post time | 400 with `tree_not_found` |
| LLM provider down | The graph emits `error` events; assistant message status → `error`; the conversation remains usable |
| Server restart mid-run | All in-memory state lost (v1 limitation). The frontend sees SSE disconnect; the conversation is empty on reload unless previously exported |
| Two concurrent posts | Both succeed; both produce independent runs |

## Why this design enables the GPS-history view

The user's metaphor only works if **every past trip is fully reconstructable**. The above gives us:

- Every assistant message → one run id → one `AgentState` → both debug views.
- No global trace to slice. No coupling between runs.
- Live and replay are the same surface; the only difference is the event source.
- Concurrent runs don't interfere; selecting one for debugging never affects another.

That is the entire scaffold. Everything in the frontend debugger is rendered from it.
