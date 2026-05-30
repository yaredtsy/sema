# Chat history & message model

> **Status — design.** Today conversations are in-memory mocks (`role: 'user' | 'assistant'`, free text). The target is the **LangChain message model** persisted verbatim — `BaseMessage.model_dump()` lives in a `payload jsonb` column, with app-only bookkeeping next to it. We don't redefine LangChain shapes; we wrap them. Zero conversion code, zero schema drift on LangChain upgrades.

The whole project's debug story hinges on this: every move the agent makes through the tree is a tool call, every tool call is an `AIMessage.tool_calls[]` entry that produces a `ToolMessage`, every message is a row. The trace panel is just the rows, expanded.

## The design rule

> **The message is LangChain's. The row is ours.** App-owned columns (`id`, `conversation_id`, `seq`, `run_id`, `delivery_status`, `created_at`) live as SQL columns. The LangChain message lives in one `payload jsonb` column, dumped by `BaseMessage.model_dump()` and rehydrated by `messages_from_dict([row.payload])[0]`. Nothing else.

Two reasons:

1. **No translation layer.** `langchain_core.messages` evolves (multimodal content blocks, new metadata fields, new message subclasses) — we get those for free because we never re-modelled them.
2. **Frontend mirrors the same dict.** If you add `@langchain/core` to the frontend later, the types line up byte-for-byte. If you don't, a small TypeScript interface mirrors the shape.

## Server schema (target)

Three tables. The conversation/run tables are app-owned; the message table is a thin wrapper around LangChain's `BaseMessage`.

```
Conversation
  id              ULID         PK
  tree_id         text         FK → trees(id), ON DELETE CASCADE
  title           text         auto-generated from first human message, editable
  model           text         conversation default model
  created_at      timestamptz
  updated_at      timestamptz
  archived_at     timestamptz NULL
  deleted_at      timestamptz NULL

Message
  id                ULID         PK
  conversation_id   ULID         FK → conversations(id), ON DELETE CASCADE
  seq               int          monotonic per-conversation; orders messages within a run
  run_id            ULID NULL    AI + Tool only: which run produced this
  delivery_status   text         'pending' | 'streaming' | 'completed' | 'error' | 'cancelled'
  parent_message_id ULID NULL    for fork
  created_at        timestamptz

  payload           jsonb        BaseMessage.model_dump() — exactly LangChain's shape
                                 see "payload shape" below
                                 type discriminator is at payload->>'type'

Run
  id                ULID         PK
  conversation_id   ULID
  human_message_id  ULID         the human turn that triggered the run
  checkpoint        jsonb        LangGraph snapshot — graph.get_state(config).values
  thread_id         text         the LangGraph thread id used to checkpoint this run
  status            text         'running' | 'completed' | 'error' | 'cancelled'
  started_at        timestamptz
  finished_at       timestamptz NULL
```

Three properties for the frontend to rely on:

- **Append-only messages.** No edits. Every change creates a new message (or a fork).
- **`seq` is the order.** `created_at` ties on streamed messages; `seq` is the deterministic order within a conversation.
- **A run owns its messages.** All AI/Tool messages produced during a run share `run_id`. Deleting a run is a no-op (we don't); messages keep pointing at it for replay.

### Why `delivery_status` and not `status`

LangChain's `ToolMessage` already has its own `status: Literal['success','error']` field (lives **inside** the payload). To avoid a naming collision, our app-level field is `delivery_status`. They don't overlap: `payload.status` tells you whether the tool succeeded; `delivery_status` tells you whether the SSE delivery is complete.

### Why `payload jsonb` and not normalized columns

LangChain's `BaseMessage` has ~10 fields that vary by subclass (`tool_calls` on AI only, `tool_call_id` on Tool only, `artifact` on Tool only, etc.) plus `additional_kwargs` and `response_metadata` which are open-ended `dict`s. Modelling each as a column means a) lots of nullable columns and b) a migration every time LangChain adds a field. `jsonb` is the right tool here — typed at the Python layer, opaque to SQL except for the type discriminator.

Two optional `GENERATED ALWAYS AS (payload->>'type') STORED` columns + index let you filter by message type without `jsonb` magic in every query:

```sql
ALTER TABLE message
  ADD COLUMN type text GENERATED ALWAYS AS (payload->>'type') STORED;
CREATE INDEX message_conv_type_idx ON message(conversation_id, type);
```

Add only if listing-by-type becomes a hot path.

## Payload shape — what's inside `payload jsonb`

The result of `BaseMessage.model_dump()` for each LangChain subclass. Shown as TypeScript to match the frontend mirror:

```ts
// Common fields on every message
interface LCBase {
  type: 'human' | 'ai' | 'system' | 'tool';
  content: string | ContentBlock[];         // multimodal-ready
  id?: string;                              // LangChain's own id (may equal Message.id)
  name?: string;                            // LangChain field; not used by us, but preserved
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
}

interface LCHuman extends LCBase {
  type: 'human';
  example?: boolean;
}

interface LCSystem extends LCBase {
  type: 'system';
}

interface LCAi extends LCBase {
  type: 'ai';
  tool_calls?: ToolCall[];                  // see below
  invalid_tool_calls?: InvalidToolCall[];   // preserve verbatim
  usage_metadata?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

interface LCTool extends LCBase {
  type: 'tool';
  tool_call_id: string;                     // required — refs an AIMessage.tool_calls[].id
  status?: 'success' | 'error';             // LangChain's own (not delivery_status!)
  artifact?: unknown;                        // optional non-content artifact
}

type LangChainMessage = LCHuman | LCSystem | LCAi | LCTool;

// LangChain ToolCall TypedDict
interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
  type?: 'tool_call';                       // discriminator
}

interface InvalidToolCall {
  name?: string;
  args?: string;                            // unparsed
  id?: string;
  error?: string;
  type?: 'invalid_tool_call';
}

// Multimodal content
type ContentBlock =
  | { type: 'text';       text: string }
  | { type: 'image_url';  image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'tool_use';   id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[] };
```

Frontend never invents these — copy from `@langchain/core/messages` if installed, otherwise mirror the interface above. If LangChain adds a field, the payload carries it forward unchanged; the TypeScript can catch up at leisure.

### Streaming chunks

LangChain emits `AIMessageChunk` during streaming. The chunk shape mirrors `AIMessage` with two extras:

```ts
interface AIMessageChunk extends Omit<LCAi, 'tool_calls'> {
  tool_call_chunks?: ToolCallChunk[];       // partial tool calls during streaming
  tool_calls?: ToolCall[];                  // post-accumulation
}

interface ToolCallChunk {
  name?: string;
  args?: string;                            // partial JSON string (concatenable)
  id?: string;
  index?: number;
  type?: 'tool_call_chunk';
}
```

When the frontend accumulates chunks for a streaming AI turn, it concatenates `content` and the `args` of matching `tool_call_chunks[index]`. The store keeps the in-flight `AIMessageChunk`; once `done` arrives, it's persisted as a normal `AIMessage` row.

## How a single agent turn looks as rows

A user asks one question. The agent walks the tree by calling tools, then answers. **Each step is its own row.** Payloads shown abridged.

```
seq | type   | payload (abridged)
----+--------+------------------------------------------------------------------------
 1  | human  | { type:'human', content:'How does Python asyncio work?' }
 2  | ai     | { type:'ai', content:'',
              |   tool_calls:[{ id:'tc-1', name:'goto_child',
              |                  args:{ child_id:'cs.languages' } }],
              |   usage_metadata:{ input_tokens:412, output_tokens:58, total_tokens:470 } }
 3  | tool   | { type:'tool', tool_call_id:'tc-1', name:'goto_child',
              |   content:'{"ok":true,"cursor":"cs.languages","children":[...]}',
              |   status:'success' }
 4  | ai     | { type:'ai', tool_calls:[{ id:'tc-2', name:'goto_child',
              |                            args:{ child_id:'cs.languages.python' }}], ... }
 5  | tool   | { type:'tool', tool_call_id:'tc-2', ... }
 6  | ai     | { type:'ai', tool_calls:[{ id:'tc-3', name:'goto_child',
              |                            args:{ child_id:'cs.languages.python.async' }}], ... }
 7  | tool   | { type:'tool', tool_call_id:'tc-3', ... }
 8  | ai     | { type:'ai',
              |   content:"## Python's asyncio Event Loop\n\n…",
              |   tool_calls:[],
              |   usage_metadata:{ input_tokens:520, output_tokens:210, total_tokens:730 } }
```

Eight rows. The user sees rows 1 and 8 by default; the chat panel folds 2–7 under the final turn. The trace panel shows all eight expanded.

This is what we mean by **the spider**: every `goto_*` tool call moves the cursor; the trace records the path; the tree overlay highlights it.

## The agent's tree-navigation tools

The agent has a small toolset declared with LangChain's `@tool` decorator server-side. The frontend doesn't enumerate it — it renders whatever `tool_calls[i].name` arrives.

```python
# backend/sace/agent/tools.py (future)
from langchain_core.tools import tool

@tool
def goto_root() -> dict:
    """Reset the cursor to the tree root."""

@tool
def goto_parent() -> dict:
    """Move the cursor up one level."""

@tool
def goto_child(child_id: str) -> dict:
    """Move the cursor down into a named child."""

@tool
def goto_sibling(sibling_id: str) -> dict:
    """Move laterally — parent then child."""

@tool
def read_detail() -> dict:
    """Read the current node's full markdown detail."""

@tool
def read_breadcrumbs() -> dict:
    """Return the path from root to the current cursor."""

@tool
def answer(text: str) -> dict:
    """Stop traversing and emit the final answer."""
```

The tools' JSON schemas come from `tool.args_schema` — `graph.bind_tools([...])` wires them up. Nothing about this leaks to the frontend except the resulting `tool_calls[]` entries on AI messages.

Two design choices baked in:

- **No `goto_id(arbitrary)` jump.** The spider only moves to neighbors. The trace stays a connected path on the tree.
- **`read_detail` is separate from `goto_*`.** Moving and reading are different verbs. The agent calls `read_detail` only when it thinks it has arrived — a useful signal in the trace.

Adding a new tool: one `@tool` in `tools.py`, one branch in `formatToolCall.ts` (frontend label), done.

## REST endpoints (frontend view)

```
GET    /trees/:treeId/conversations
       ?after=<convId>&limit=50&archived=false
       → { conversations: ConversationSummary[], next_cursor?: string }

POST   /trees/:treeId/conversations
       Body: { model?, title? }
       → 201 { Conversation }

GET    /conversations/:id                          ← includes all messages, any type
       → { Conversation, messages: MessageRow[] }   ← row shape; payload inline

PATCH  /conversations/:id
       Body: { title?, model?, archived?: boolean }
       → 200 { Conversation }

DELETE /conversations/:id                          ← soft delete
       → 204

POST   /conversations/:id/messages
       Body: { content: string, model? }            ← server constructs a HumanMessage, starts a Run
       → 202 { human_message_id, run_id }
                                                    ← subsequent AI/Tool messages stream via SSE

POST   /conversations/:id/fork
       Body: { from_message_id, title? }
       → 201 { Conversation }                       ← messages 0..from_message_id copied

GET    /conversations/:id/export
       → application/json                            ← conv + messages (every type) + run checkpoints

POST   /trees/:treeId/conversations/import
       Body: exported JSON
       → 201 { Conversation }
```

`MessageRow` is the wrapper + payload, shipped verbatim:

```ts
interface MessageRow {
  id: string;
  conversation_id: string;
  seq: number;
  run_id?: string;
  delivery_status: 'pending' | 'streaming' | 'completed' | 'error' | 'cancelled';
  parent_message_id?: string;
  created_at: string;
  payload: LangChainMessage;          // ← the LangChain dict
}
```

Only `POST /messages` triggers work. Everything else is reads. The SSE stream for the resulting run carries native LangGraph chunks — see [07-agent-wiring.md](./07-agent-wiring.md).

## Chat panel rendering

The chat panel groups by **agent turn**, not by row. One turn = one human message + the AI/Tool rows produced by its run.

```
┌──────────────────────────────────────────────────────────┐
│ [You]  How does Python's asyncio event loop work?        │   payload.type='human'
├──────────────────────────────────────────────────────────┤
│ [Agent]                                                   │   final AIMessage
│                                                           │
│ ## Python's asyncio Event Loop                            │
│ Python's `asyncio` module implements cooperative…         │
│                                                           │
│ ▸ 3 tool calls · cs → languages → python → async   ◀──── │   collapsed strip
│ ▸ Show reasoning (opens trace) · 1.2s · gpt-4.1-mini ◀── │
└──────────────────────────────────────────────────────────┘
```

Rendering rules — read `payload.type`:

1. **`human`** — a plain bubble with `payload.content` (handle string vs ContentBlock[]).
2. **`ai` with `content`** — a plain bubble. If `tool_calls[]` is also non-empty *and* `content` is non-empty (rare; some models do this), render the tool calls below as a folded strip.
3. **`ai` with `tool_calls` and empty `content`** — an *intermediate* AI turn. Roll up into the final AI turn of the same run. Users never see a "thinking-only" bubble.
4. **`tool`** — never rendered directly in the chat panel. Visible in the trace panel only.
5. **`system`** — never rendered in the chat. Lives in the trace and in export.

The folded strip lists each `tool_calls[i].name + args` (formatted via `formatToolCall.ts`) but **does not** show tool results — those are trace-panel territory. "Show reasoning" is the bridge.

### Streaming view (run is live)

```
┌──────────────────────────────────────────────────────────┐
│ [You]  …question…                                        │
├──────────────────────────────────────────────────────────┤
│ [Agent]   ● spider walking…                              │   live AIMessageChunk
│                                                           │
│   ↳ goto_child cs.languages                          1ms │   each tool_call_chunk
│   ↳ goto_child cs.languages.python                  280ms│   accumulates here
│   ↳ goto_child cs.languages.python.async            260ms│
│                                                           │
│   (waiting for answer…)                                   │
└──────────────────────────────────────────────────────────┘
```

Once the run completes, the live strip collapses into the rolled-up view above. The "Show reasoning" link enables.

## Trace panel rendering

The trace panel is the full, expanded view of the same rows.

```
┌──────────────────────────────────────────────────────────┐
│  Run run-01    ● completed    8 rows    3 tool calls      │
│  Cursor path: cs → languages → python → async            │
├──────────────────────────────────────────────────────────┤
│  [seq 2] AIMessage                                        │
│       tool_call: goto_child("cs.languages")               │
│       usage: in 412 / out 58    gpt-4.1-mini · 380 ms     │
├──────────────────────────────────────────────────────────┤
│  [seq 3] ToolMessage  goto_child   status:success         │
│       { ok: true, cursor: "cs.languages",                 │
│         children: ["python","rust"] }                     │
├──────────────────────────────────────────────────────────┤
│  [seq 4] AIMessage    goto_child("cs.languages.python")   │
│  [seq 5] ToolMessage  …                                    │
│  [seq 6] AIMessage    goto_child("…python.async")          │
│  [seq 7] ToolMessage  …                                    │
├──────────────────────────────────────────────────────────┤
│  [seq 8] AIMessage    (final answer)                      │
│       ## Python's asyncio Event Loop                      │
│       …                                                    │
│       usage: in 520 / out 210                             │
└──────────────────────────────────────────────────────────┘
```

The trace panel is the spider's diary. The tree canvas is the spider's footprint. They share `run_id`.

## React Query keys

| Key | Returns | Stale |
|---|---|---|
| `qk.conversations(treeId)` | `ConversationSummary[]` | 30 s, refetch on focus |
| `qk.conversation(id)` | `Conversation + messages: MessageRow[]` | 0 s (invalidate on mutation) |
| `qk.run(runId)` | `Run` (includes `checkpoint`) | Infinity (immutable once done) |

`ConversationSummary` for the sidebar (cheap shape, no payloads):

```ts
interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  message_count: number;            // visible turns (human + final-ai)
  tool_call_count: number;          // sum across runs — a "complexity" signal
  last_message_at: string;
  last_excerpt: string;             // last AI message content, first 80 chars
  archived: boolean;
}
```

Mutations and invalidations:

| Mutation | Invalidates |
|---|---|
| `createConversation(treeId)` | `qk.conversations(treeId)` |
| `sendMessage(convId, …)` | `qk.conversation(convId)` |
| `renameConversation(id, …)` | `qk.conversations(treeId)`, `qk.conversation(id)` |
| `archiveConversation(id)` | `qk.conversations(treeId)` |
| `forkConversation(convId, fromMsgId)` | `qk.conversations(treeId)` |

## Sidebar UX

```
┌─────────────────────────┐
│  sace                   │     brand
│  Tree: Computer Science │     header — current tree (link to /trees/:id)
│  ──────────────────────│
│  [+ New conversation]   │
│  🔍 Search…             │
│  ──────────────────────│
│  TODAY                  │
│  ●  How does asyncio… ▢ │     ● = live (a run in this conv is streaming)
│       3 tools  gpt-4.1m │     tools-count + model badge
│  ○  Compare to threads  │
│       1 tool   gpt-4o-m │
│                         │
│  YESTERDAY              │
│  ○  Explain ownership   │
│       3 tools  gpt-4.1m │
│  …                      │
│                         │
│  ── archived (12) ─────│
└─────────────────────────┘
```

Date buckets: Today / Yesterday / This week / Earlier. The `N tools` count gives an at-a-glance feel for how deep the spider had to go.

Per-row hover affordances: `Pin`, `Rename`, `Archive`, `Delete`, `Open in new tab`.

## Title generation

Auto-titles come from the first **human** message.

1. Client trims, takes the first 80 chars, ends at a sentence boundary if possible.
2. POST creates the conversation **without** a title.
3. After the first run completes, server runs a small LLM to summarize the question. PATCHes `Conversation.title`. Tracks `title_set_by_user` so a rename is sticky.

## Fork

A user hovers over an AI bubble and gets "Fork from here":

1. `POST /conversations/:convId/fork { from_message_id }`
2. Server copies messages `[0..from_message_id]` (all types, including tool messages) into a new conversation; sets `parent_message_id`.
3. Client navigates to the new conversation.

Why all types: forks need the agent's prior tool history so a follow-up question can build on the cursor's current location.

## Search

1. **In-sidebar grep (v1).** Client-side `includes` over `title` and `last_excerpt`.
2. **Server full-text (future).** When trees grow to thousands of conversations.
3. **In-transcript search** is `⌘F` (browser native) for v1.

## Retention

- **Soft delete** by default. Replay links shared in old URLs keep working until hard-deleted by admin script.
- The sidebar **never shows** soft-deleted conversations. Reaching one by URL renders an inline notice.

## Export / import

`GET /conversations/:id/export` returns:

```json
{
  "schema_version": 1,
  "exported_at": "...",
  "tree": { "id": "cs", "snapshot": { /* optional Tree at export time */ } },
  "conversation": { /* Conversation */ },
  "messages": [
    {
      "id": "...", "seq": 1, "delivery_status": "completed", "created_at": "...",
      "payload": { "type": "human", "content": "..." }
    },
    {
      "id": "...", "seq": 2, "delivery_status": "completed", "run_id": "...", "created_at": "...",
      "payload": { "type": "ai", "content": "", "tool_calls": [...] }
    },
    {
      "id": "...", "seq": 3, "delivery_status": "completed", "run_id": "...", "created_at": "...",
      "payload": { "type": "tool", "tool_call_id": "...", "content": "...", "status": "success" }
    }
  ],
  "runs": { "<run_id>": { /* Run row including checkpoint */ } }
}
```

Self-contained. Importable into any tree (ids re-minted, `parent_message_id` rewritten or dropped if it pointed cross-conversation).

Server-side, `messages_from_dict([row.payload for row in rows])` rehydrates them straight back into `BaseMessage` instances — no custom deserializer.

## Server-side ergonomics

Two helpers worth writing once in `backend/sace/store/messages.py`:

```python
from langchain_core.messages import BaseMessage, messages_from_dict, messages_to_dict

def row_to_message(row: MessageRow) -> BaseMessage:
    return messages_from_dict([row.payload])[0]

def message_to_payload(msg: BaseMessage) -> dict:
    return msg.model_dump()
```

The agent never sees `MessageRow`; it sees `BaseMessage`. The API layer never sees `BaseMessage`; it sees `MessageRow` (which already serializes correctly via Pydantic — `payload` is `dict`).

## What does *not* live in the sidebar

- **Cross-tree conversations.** Per-tree only.
- **Run-level details.** Trace panel's job.
- **Tree authoring entry.** Sidebar links to `/trees/:id`; doesn't embed edit UI.
- **Settings.** Sidebar is for navigation.

## Component map

```
features/history/
├── components/
│   ├── HistorySidebar.tsx           ← layout + virtualized list
│   ├── ConversationItem.tsx         ← row + hover actions + tool-count + model badge
│   ├── NewConversationButton.tsx
│   ├── SearchInput.tsx
│   ├── DateBucket.tsx
│   └── ArchivedFooter.tsx
├── hooks/
│   ├── useConversations.ts          ← React Query list + paginate
│   ├── useCreateConversation.ts
│   ├── useConversationActions.ts    ← rename / archive / delete / fork
│   └── useConversationFilter.ts
├── lib/
│   ├── groupByDate.ts
│   ├── titleFallback.ts
│   └── countTools.ts                ← walk messages[].payload.tool_calls
├── types.ts                          ← ConversationSummary
└── index.ts
```

```
features/chat/
├── components/
│   ├── ChatPanel.tsx
│   ├── MessageList.tsx              ← groups by turn (human + run)
│   ├── HumanBubble.tsx              ← reads MessageRow with payload.type='human'
│   ├── AssistantBubble.tsx          ← final AI: content + folded tool strip + Show reasoning
│   ├── ToolStrip.tsx                ← folded list of tool calls from AIMessage.tool_calls
│   ├── LiveTurn.tsx                 ← streaming AIMessageChunk view
│   ├── Composer.tsx
│   └── ModelPicker.tsx
├── hooks/
│   ├── useMessages.ts               ← React Query; merges optimistic + canonical
│   ├── useSendMessage.ts            ← mutation + opens SSE + appends to runs store
│   ├── useTurnGrouping.ts           ← groups MessageRow[] into turn-groups by run_id
│   └── useComposerDraft.ts
├── lib/
│   ├── modelRegistry.ts             ← see 05-model-selection.md
│   ├── formatToolCall.ts            ← "goto_child cs.languages" → human label
│   ├── groupByTurn.ts               ← pure grouper over MessageRow[]
│   ├── langchainTypes.ts            ← LCBase, LCHuman, LCSystem, LCAi, LCTool, ToolCall, …
│   └── accumulateChunk.ts           ← AIMessageChunk → growing AIMessage
├── types.ts                          ← MessageRow, TurnGroup
└── index.ts
```

`langchainTypes.ts` is the single place those interfaces live. If you install `@langchain/core`, the file becomes a thin re-export. If you don't, it's hand-mirrored. Same imports either way.

## Cross-references

- [02-url-and-entry.md](./02-url-and-entry.md) — `?conv` opens a conversation; `?msg=<message_id>` opens the trace focused on that AI turn.
- [04-state-and-data.md](./04-state-and-data.md) — React Query keys, store shapes, `accumulateChunk` reducer.
- [05-model-selection.md](./05-model-selection.md) — `model` lives on `Conversation` (default) and per `Message` (override stored in `payload.response_metadata.model` or a sibling app column — pick one and stick).
- [07-agent-wiring.md](./07-agent-wiring.md) — how LangGraph's native stream becomes SSE; how the run terminates.
