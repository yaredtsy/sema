# Conversation & Message schema

The data layer that makes multi-turn chat and per-message debugging work. Three types: `Conversation`, `Message`, `Run`. They are independent of the `Node` schema — they reference trees by id only.

> **Status:** the Pydantic shapes below are the design. The SQLAlchemy tables and `ConversationManager` are **not yet implemented** — only `trees` and `nodes` exist in the DB today. This doc is the spec the next persistence PR builds against. See [05-database-and-orm.md](./05-database-and-orm.md) for the ORM patterns we'll follow.

## The relationship in one diagram

```
Conversation 1 ─── N Message
                       │
                       └── (assistant only) ── 1:1 ── Run ─── 1 ── AgentState
                                                                       │
                                                                       └─── N TraceStep
```

- A `Conversation` has many `Message`s, in order.
- Each `assistant` `Message` has exactly one `Run` (the trip the agent took).
- Each `Run` carries one `AgentState` (the saved record — the GPS log).

User messages have no run. System/error messages (optional, for surfacing failures) also have no run.

## Pydantic models

```python
# backend/sace/schema/conversation.py
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    id: str                                  # ULID-style, unique within conversation
    conversation_id: str
    role: Literal["user", "assistant", "system"]
    content: str                             # markdown for assistant; plain for user
    run_id: Optional[str] = None             # set iff role == "assistant"
    created_at: str                          # ISO-8601
    status: Literal["pending", "streaming", "completed", "cancelled", "error"] = "completed"


class Conversation(BaseModel):
    id: str
    tree_id: str                             # which tree this conversation queries against
    created_at: str
    messages: list[Message] = Field(default_factory=list)
    # transient: not persisted; recomputed from messages
    # active_run_id: derived as the most recent message with status == "streaming"


class RunSummary(BaseModel):
    """Lightweight reference; full run via GET /runs/{id}."""
    run_id: str
    conversation_id: str
    message_id: str
    tree_id: str
    model: str
    status: Literal["running", "completed", "cancelled", "error"]
    steps: int
    final_cursor_id: Optional[str] = None
    started_at: str
    finished_at: Optional[str] = None
```

`Run` itself is just the `AgentState` JSON (see [03-agent/02-agent-state.md](../03-agent/02-agent-state.md)) keyed by `run_id`. We don't model it separately — the state IS the run.

## Lifecycle of a single message

```
USER sends text
   │
   ▼
Conversation.messages.append(Message(role=user, content=text, status=completed))
   │
   ▼
Conversation.messages.append(Message(role=assistant, content="", run_id=R, status=pending))
   │
   ▼
RunRegistry.start(run_id=R, conversation_id=C, message_id=M, query=text, tree_id=...)
   │
   ▼  (agent loop runs; events stream)
assistant message status: pending → streaming → completed
content fills in as `final` arrives (or as `answer_token` streams)
   │
   ▼
RunSummary recorded; AgentState persisted in-memory keyed by run_id
```

## Why one run per assistant message

This is the most important design choice in the conversation layer. The alternatives:

| Choice | Pros | Cons |
|---|---|---|
| **One run per message** (chosen) | Clean lookup; replay is trivial; debugging by message id maps directly to a run id; cancellation scope is one message | Each turn re-pays "start from root" cost |
| Long-lived run, multiple messages | Cursor persists; might be cheaper | "Which step belongs to which message?" gets ugly; debugging a specific message means slicing a global trace; cancellation semantics blur |
| Run-per-conversation | Cleanest model? | Doesn't fit a tree-walker that resets per query — and most queries want a fresh root |

We picked one-run-per-message because **the debugger requires it**. The user says "debug message 3" → we lookup `messages[3].run_id` → we serve `runs[run_id]` → both debug views render. No slicing, no scoping. This is the pivot the whole observability story depends on.

Multi-turn context is still preserved: when composing a new query, the prompt builder *may* include the prior message(s) as conversation context — but the walk itself starts fresh from the root. We will revisit only if the experiment demands it.

## Storage — SQLAlchemy target

When this lands, it slots into the existing `backend/sace/db/` package next to `TreeRow` / `NodeRow`. Tables:

```python
# backend/sace/db/models.py  (planned)

class ConversationRow(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)           # ULID
    tree_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("trees.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    messages: Mapped[list["MessageRow"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="MessageRow.created_at",
    )


class MessageRow(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)           # ULID
    conversation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))                            # 'user'|'assistant'|'system'
    content: Mapped[str] = mapped_column(Text, default="")
    run_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("runs.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    status: Mapped[str] = mapped_column(String(16), default="completed")     # pending|streaming|completed|cancelled|error
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    conversation: Mapped[ConversationRow] = relationship(back_populates="messages")
    run: Mapped["RunRow | None"] = relationship()


class RunRow(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    message_id: Mapped[str] = mapped_column(String(64), index=True)
    tree_id: Mapped[str] = mapped_column(String(128))
    model: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="running")
    state_json: Mapped[str] = mapped_column(Text)                            # full AgentState as JSON
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

Design notes:

- **`runs.state_json` is the full `AgentState` JSON blob.** Replay is one read: `SELECT state_json FROM runs WHERE id = ?`. This is intentional — querying *inside* a run isn't a use case (the frontend reduces the state in JS). When that changes, we promote fields out of the blob to columns; until then, one column keeps writes atomic and the schema small.
- **`messages.run_id` is `UNIQUE` + nullable.** One run per assistant message, zero runs per user message. The unique constraint enforces it.
- **Indexes** on `messages.conversation_id` and `runs.conversation_id` cover the common queries: "all messages for a conversation", "all runs for a conversation".
- **Cascades:** dropping a conversation drops its messages and its runs. Dropping a tree drops the conversations using it (catches the case of "I deleted the tree out from under an open chat").

### Migration moment

Adding these tables is the trigger we set in [05-database-and-orm.md](./05-database-and-orm.md) for adopting Alembic:

1. `uv add alembic`.
2. Initialize Alembic, point at `Base.metadata` and `SACE_DATABASE_URL`.
3. Stop calling `init_db()` in lifespan; replace with `alembic upgrade head`.
4. Baseline migration captures the current `trees` + `nodes`.
5. Second migration adds `conversations`, `messages`, `runs`.

That happens in one PR. From then on, every schema change is an Alembic revision.

### Export/import — backup, not persistence

Even after the tables land, we keep:

- `POST /api/v1/conversations/{cid}/export` — returns the conversation + all referenced `AgentState`s as one JSON. Manual backup; git-friendly.
- `POST /api/v1/conversations/import` — accepts that JSON and inserts rows.

Reasons: shareable debug sessions, regression fixtures for prompt changes, and a recovery hatch.

## Conversation context in the agent prompt

In v1, the agent treats each user message as independent. The XML routing prompt does **not** include prior turns; the answer prompt does **not** include prior turns. The walk starts at the root.

The reason is twofold:
- Mini models stay sharper on a smaller context.
- The hypothesis is about local routing decisions — multi-turn context would muddy the signal.

The data model is ready for multi-turn context when we want it: `Conversation.messages[:i]` is always reachable. We just don't pass it in yet. Document the change as an experiment when it ships.

## Validation rules

- `Message.role` must be one of the three literals. Anything else is a 400.
- `Message.run_id` is required when `role == "assistant"`. Enforced in a Pydantic model validator.
- `Message.content` may be empty string for assistant messages in `pending` state.
- `Conversation.tree_id` must exist in `TreeStore` at creation time. If the tree is later removed, conversation reads still work but new messages are rejected.

## What is NOT in v1

- Editing past user messages.
- Branching: "let me re-run message 3 with a different model".
- Reactions / annotations on messages.
- Per-message access control.

All four have natural slots in this schema. None are built.
