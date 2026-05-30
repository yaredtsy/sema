# Chat history & message model

> **Status — design.** Today conversations are in-memory mocks (`role: 'user' | 'assistant'`, free text). The target is a **LangGraph-shaped** message model: Human / AI / Tool / System, with **the agent's tree traversal expressed as tool calls** — the "spider" walking up and down the tree. Persisted per-tree. The trace panel is where you watch the walk; the chat panel shows the same calls folded under each assistant turn.

The whole project's debug/inspect story hinges on this: every move the agent makes through the tree is a tool call, every tool call is a message, every message is a row. That single decision is what makes the GPS-history surface work — the trace is just the messages, expanded.

## The message model — LangGraph-shaped

Four message types, mirroring `langchain_core.messages.BaseMessage`:

```ts
type MessageType = 'human' | 'ai' | 'tool' | 'system';

interface Message {
  id: string;                          // ULID
  conversation_id: string;
  type: MessageType;
  content: string;                     // markdown for human/ai, JSON-stringified result for tool
  status: 'pending' | 'streaming' | 'completed' | 'error' | 'cancelled';

  // AI-only — present when this AI turn called tools
  tool_calls?: ToolCall[];             // [{ id, name, args }]

  // Tool-only — points back to the AI tool_call that requested it
  tool_call_id?: string;
  tool_name?: string;

  // bookkeeping
  run_id?: string;                     // AI + tool: which agent run produced this
  model?: string;                      // AI: which model produced it (override; null = conv default)
  parent_message_id?: string;          // for forks; null = top-level

  created_at: string;
}

interface ToolCall {
  id: string;                          // matches a future ToolMessage.tool_call_id
  name: string;                        // e.g. 'goto_child'
  args: Record<string, unknown>;       // e.g. { child_id: 'cs.languages.python' }
}
```

This is the same shape LangChain stores (rename `type` → `_type` or `role` if needed for wire-compat with a specific LangChain version; the four-class taxonomy is what matters).

### How a single agent turn looks as a sequence

A user asks one question. The agent walks the tree by calling tools, then answers. **Each step is its own row.**

```
[0] HumanMessage    "How does Python's asyncio event loop work?"

[1] AIMessage       content: ""                       ← thinking only, no answer yet
                    tool_calls: [{ id: tc-1, name: 'goto_child',
                                   args: { child_id: 'cs.languages' } }]
[2] ToolMessage     tool_call_id: tc-1
                    tool_name: 'goto_child'
                    content: '{"ok":true,"cursor":"cs.languages","children":[…]}'

[3] AIMessage       content: ""
                    tool_calls: [{ id: tc-2, name: 'goto_child',
                                   args: { child_id: 'cs.languages.python' } }]
[4] ToolMessage     tool_call_id: tc-2
                    content: '{"ok":true,"cursor":"cs.languages.python","children":[…]}'

[5] AIMessage       content: ""
                    tool_calls: [{ id: tc-3, name: 'goto_child',
                                   args: { child_id: 'cs.languages.python.async' } }]
[6] ToolMessage     tool_call_id: tc-3
                    content: '{"ok":true,"cursor":"…async","detail":"…asyncio module…"}'

[7] AIMessage       content: "## Python's asyncio Event Loop\n\n…"   ← the final answer
                    tool_calls: []
                    run_id: run-01
```

One human turn → eight messages. The user sees turns [0] and [7] by default; the chat panel folds [1]–[6] under [7] (see "Chat panel rendering" below). The trace panel shows all eight expanded.

This is what we mean by **the spider**: every `goto_*` tool call moves the cursor; the trace records the path; the tree overlay highlights it.

## The agent's tree-navigation tools

The agent has a fixed, small toolset. Each tool moves or reads the cursor. **The cursor is the spider's position.**

| Tool | Purpose | Args | Returns |
|---|---|---|---|
| `goto_root` | Reset cursor to the tree root | — | `{ cursor, children }` |
| `goto_parent` | Move up one level | — | `{ cursor, children }` or error if at root |
| `goto_child` | Move down into a named child | `{ child_id }` | `{ cursor, children }` |
| `goto_sibling` | Move laterally (parent then child) | `{ sibling_id }` | `{ cursor, children }` |
| `read_detail` | Read the current node's full `detail` (markdown) | — | `{ cursor, detail }` |
| `read_breadcrumbs` | Get the path from root to the current cursor | — | `{ path: [{ id, title }, …] }` |
| `answer` | Stop traversing and emit the final answer | `{ text }` | terminates the run |

Two design choices baked in:

- **No `goto_id(arbitrary)` jump.** The spider only moves to neighbors. This keeps the trace a connected path on the tree (the visualization assumes that). If the agent needs random access, it goes via `goto_root` and walks back down — visible in the trace.
- **`read_detail` is separate from `goto_*`.** Moving and reading are different verbs. The agent calls `read_detail` only when it thinks it has arrived; that's a useful signal in the trace ("the agent decided this is the answer node").

The toolset is defined backend-side in `backend/sace/agent/tools.py` (future file). The frontend doesn't enumerate it — the chat panel renders whatever tool name comes back. Adding a new tool is one entry in the backend's tool registry and a one-line `formatToolCall` case in the frontend.

## Server schema (target)

Three new tables. Designed elsewhere ([02-data-model/04-conversation-schema.md](../../02-data-model/04-conversation-schema.md)) — recapped here with the LangGraph shape.

```
Conversation
  id              ULID     PK
  tree_id         text     FK → trees(id), ON DELETE CASCADE
  title           text     auto-generated from first human message, editable
  model           text     conversation default model
  created_at      timestamptz
  updated_at      timestamptz
  archived_at     timestamptz NULL
  deleted_at      timestamptz NULL

Message
  id                ULID     PK
  conversation_id   ULID     FK → conversations(id), ON DELETE CASCADE
  type              text     'human' | 'ai' | 'tool' | 'system'
  content           text     markdown for human/ai; JSON for tool result
  status            text     'pending' | 'streaming' | 'completed' | 'error' | 'cancelled'
  tool_calls        jsonb NULL   -- AI only: [{ id, name, args }]
  tool_call_id      text NULL    -- Tool only: matches a tool_calls[].id
  tool_name         text NULL    -- Tool only: convenience
  run_id            ULID NULL    -- AI + Tool: which run produced this
  model             text NULL    -- AI only: model override
  parent_message_id ULID NULL    -- for fork
  seq               int          -- monotonic per-conversation; orders messages within a run
  created_at        timestamptz

Run
  id              ULID     PK
  conversation_id ULID
  human_message_id ULID    -- the user turn that triggered the run
  agent_state     jsonb    -- full AgentState dump (the replay source)
  status          text     'running' | 'completed' | 'error' | 'cancelled'
  started_at      timestamptz
  finished_at     timestamptz NULL
```

Three properties for the frontend to rely on:

- **Append-only messages.** No edits. Every change creates a new message (or a fork).
- **`seq` is the order.** `created_at` ties on streamed messages; `seq` is the deterministic order within a conversation.
- **A run owns its messages.** All AI/Tool messages produced during a run share `run_id`. Deleting a run is a no-op (we don't); the messages keep pointing at it for replay.

## REST endpoints (frontend view)

```
GET    /trees/:treeId/conversations
       ?after=<convId>&limit=50&archived=false
       → { conversations: ConversationSummary[], next_cursor?: string }

POST   /trees/:treeId/conversations
       Body: { model?, title? }
       → 201 { Conversation }

GET    /conversations/:id                          ← includes all messages, any type
       → { Conversation, messages: Message[] }

PATCH  /conversations/:id
       Body: { title?, model?, archived?: boolean }
       → 200 { Conversation }

DELETE /conversations/:id                          ← soft delete
       → 204

POST   /conversations/:id/messages
       Body: { content: string, model? }            ← creates a HumanMessage, starts a Run
       → 202 { human_message_id, run_id }
                                                    ← subsequent AI/Tool messages stream via SSE

POST   /conversations/:id/fork
       Body: { from_message_id, title? }
       → 201 { Conversation }                       ← messages 0..from_message_id copied

GET    /conversations/:id/export
       → application/json                            ← conv + all messages (every type) + all run agent_states

POST   /trees/:treeId/conversations/import
       Body: exported JSON
       → 201 { Conversation }
```

Only `POST /messages` triggers work. Everything else is reads. The SSE stream for the resulting run carries `ai_message`, `tool_call`, `tool_result`, and `final` events — see [07-agent-wiring.md](./07-agent-wiring.md).

## Chat panel rendering

The chat panel groups by **agent turn**, not by message. One turn = one human message + the AI/Tool messages produced by its run.

```
┌──────────────────────────────────────────────────────────┐
│ [You]  How does Python's asyncio event loop work?        │   HumanMessage
├──────────────────────────────────────────────────────────┤
│ [Agent]                                                   │   AIMessage (final, content)
│                                                           │
│ ## Python's asyncio Event Loop                            │
│ Python's `asyncio` module implements cooperative…         │
│                                                           │
│ ▸ 3 tool calls · cs → languages → python → async   ◀──── │   collapsed strip (renderer
│                                                          │   shows tool path inline)
│ ▸ Show reasoning (opens trace) · 1.2s · gpt-4.1-mini ◀── │
└──────────────────────────────────────────────────────────┘
```

Three rendering rules:

1. **HumanMessage** — a plain bubble with content.
2. **AIMessage with content** — a plain bubble with the markdown. If it has `tool_calls` *and* a final `content`, the tool calls render below as a folded strip (`▸ N tool calls · <cursor path>`).
3. **AIMessage with tool_calls but no content** — an *intermediate* AI turn. In the chat panel, it's **rolled up** into the final AI turn (it's part of the same run). Users never see a "thinking-only" bubble.
4. **ToolMessage** — never rendered directly in the chat panel. Visible in the trace panel only.
5. **SystemMessage** — never rendered in the chat. Lives in the trace and in export.

When the user expands the folded strip, the strip itself shows the path the spider walked (each tool call's `args.child_id` / direction) but **does not** show the tool results — those are trace-panel territory. The "Show reasoning" link is the bridge.

### Streaming view (while the run is live)

```
┌──────────────────────────────────────────────────────────┐
│ [You]  …question…                                        │
├──────────────────────────────────────────────────────────┤
│ [Agent]   ● spider walking…                              │   live placeholder
│                                                           │
│   ↳ goto_child cs.languages                          1ms │   each tool_call appears
│   ↳ goto_child cs.languages.python                  280ms│   as it arrives
│   ↳ goto_child cs.languages.python.async            260ms│
│                                                           │
│   (waiting for answer…)                                   │   final content not yet
└──────────────────────────────────────────────────────────┘
```

Once `final` arrives, the live strip collapses into the rolled-up view above. The "Show reasoning" link is enabled.

## Trace panel rendering

The trace panel is the full, expanded view of the same messages. **Every tool call and every tool result is its own card.**

```
┌──────────────────────────────────────────────────────────┐
│  Run run-01    ● completed    8 messages    3 tool calls │
│  Cursor path: cs → languages → python → async            │
├──────────────────────────────────────────────────────────┤
│  [1] AIMessage                                            │
│       tool_call: goto_child("cs.languages")               │
│       ── thinking: "asyncio is a Python language feature"  │
│       380 ms · in 412 / out 58 · gpt-4.1-mini             │
├──────────────────────────────────────────────────────────┤
│  [2] ToolMessage  goto_child                              │
│       { ok: true, cursor: "cs.languages",                 │
│         children: ["python","rust"] }                     │
├──────────────────────────────────────────────────────────┤
│  [3] AIMessage    goto_child("cs.languages.python")  …    │
│  [4] ToolMessage  …                                        │
│  [5] AIMessage    goto_child("…python.async")        …    │
│  [6] ToolMessage  …                                        │
├──────────────────────────────────────────────────────────┤
│  [7] AIMessage    (final answer)                          │
│       ## Python's asyncio Event Loop                      │
│       …                                                    │
│       1240 ms · in 520 / out 210                          │
└──────────────────────────────────────────────────────────┘
```

The trace panel is the spider's diary. The tree canvas is the spider's footprint. They share `run_id`.

## React Query keys

| Key | Returns | Stale |
|---|---|---|
| `qk.conversations(treeId)` | `ConversationSummary[]` | 30 s, refetch on focus |
| `qk.conversation(id)` | `Conversation + messages[]` (all types) | 0 s (invalidate on mutation) |
| `qk.run(runId)` | `AgentState` | Infinity (immutable once done) |

`ConversationSummary` for the sidebar (cheap shape):

```ts
interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  message_count: number;            // counts human + ai-with-content (the visible turns)
  tool_call_count: number;          // sum across runs — a "complexity" signal
  last_message_at: string;
  last_excerpt: string;             // last AI content, first 80 chars
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
│       3 tools  gpt-4.1m │     small tools-count + model badge
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

Date buckets: Today / Yesterday / This week / Earlier (older than 7 days). The small `N tools` count gives an at-a-glance feel for how deep the spider had to go.

Per-row affordances (on hover):

- `Pin`, `Rename`, `Archive`, `Delete`, `Open in new tab` — same as standard.

## Title generation

Auto-titles come from the first **human** message (not the AI's tool calls).

1. Client trims, takes the first 80 chars, ends at a sentence boundary if possible.
2. POST creates the conversation **without** a title.
3. After the first turn's `final` arrives, server runs a small LLM to summarize the question. PATCHes `Conversation.title`. Tracks `title_set_by_user` so a rename is sticky.

## Fork

A user hovers over an AI bubble and gets "Fork from here":

1. `POST /conversations/:convId/fork { from_message_id }`
2. Server copies messages `[0..from_message_id]` (all types, including tool messages) into a new conversation; sets `parent_message_id`.
3. Client navigates to the new conversation.

Why all types: forks need the agent's prior tool history so a follow-up question can build on the cursor's current location instead of restarting at root.

## Search

1. **In-sidebar grep (v1).** Client-side `includes` over `title` and `last_excerpt`.
2. **Server full-text (future).** When trees grow to thousands of conversations.
3. **In-transcript search** is `⌘F` (browser native) for v1.

A future "search by tool path" (`tools:goto_child(python)`) is reserved — not needed at this scale.

## Retention

- **Soft delete** by default. Replay-links shared in old URLs keep working until hard-deleted by admin script.
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
    { "type": "human", "content": "..." },
    { "type": "ai",    "content": "", "tool_calls": [...] },
    { "type": "tool",  "tool_call_id": "...", "content": "..." },
    ...
  ],
  "runs":    { "<run_id>": { /* AgentState */ } }
}
```

Self-contained. Importable into any tree (ids re-minted, `parent_message_id` rewritten or dropped if it pointed cross-conversation).

## What does *not* live in the sidebar

- **Cross-tree conversations.** Per-tree only.
- **Run-level details.** Trace panel's job.
- **Tree authoring entry.** The sidebar links to `/trees/:id`; it doesn't embed edit UI.
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
│   └── countTools.ts                ← count tool-call entries across runs
├── types.ts
└── index.ts
```

```
features/chat/
├── components/
│   ├── ChatPanel.tsx
│   ├── MessageList.tsx              ← groups by turn (human + run)
│   ├── HumanBubble.tsx
│   ├── AssistantBubble.tsx          ← final content + folded tool strip + Show reasoning link
│   ├── ToolStrip.tsx                ← folded list of tool calls (path the spider walked)
│   ├── LiveTurn.tsx                 ← streaming view (tool calls appear as they arrive)
│   ├── Composer.tsx
│   └── ModelPicker.tsx
├── hooks/
│   ├── useMessages.ts               ← React Query; merges optimistic + canonical
│   ├── useSendMessage.ts            ← mutation + opens SSE + appends to runs store
│   ├── useTurnGrouping.ts           ← turns the flat messages[] into turn-groups
│   └── useComposerDraft.ts
├── lib/
│   ├── modelRegistry.ts             ← see 05-model-selection.md
│   ├── formatToolCall.ts            ← "goto_child cs.languages" → human label
│   └── groupByTurn.ts               ← pure grouper
├── types.ts                          ← Message, ToolCall, TurnGroup
└── index.ts
```

## Cross-references

- [02-url-and-entry.md](./02-url-and-entry.md) — `?conv` opens a conversation; `?msg=<ai_message_id>` opens the trace focused on that AI turn.
- [04-state-and-data.md](./04-state-and-data.md) — React Query keys and invalidation; `useChatStore.optimisticByConv` shape.
- [05-model-selection.md](./05-model-selection.md) — `model` lives on `Conversation` (default) and per `Message` (override).
- [07-agent-wiring.md](./07-agent-wiring.md) — how the spider's tool calls become SSE events; how the run terminates with `answer`.
