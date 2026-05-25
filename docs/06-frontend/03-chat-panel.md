# Chat panel (Cursor-style streaming)

Right side of the screen. The user's input surface and the live narration of the agent's work. Modeled on modern AI coding tools (Cursor, Claude Code, Cline): the assistant message **unfolds in place** as the agent thinks, picks tools, and produces its answer.

> **Status — experimental.** The "Cursor-style" foldouts described below are the **target design**. What ships today is simpler: a flat assistant bubble with the final markdown answer plus a single collapsible **"route summary" pill** under it (visited-id breadcrumb + per-step `node → child` lines + a "Debug this" button that sets `uiStore.debugTarget`). No streaming exists yet — the chat is fed from pre-baked `AgentRun` records in `mockData.ts`. The user input is a single-line `<input>` with a "Send" button; submitting fakes a 600 ms delay and inserts a placeholder assistant message that points the reader at the debug panel.

## What ships today

```
┌──────────────────────────────────────────────────────────┐
│  [user] How does Python's asyncio event loop work?        │
│                                                          │
│  [ai]   ## Python's asyncio Event Loop                    │
│         Python's `asyncio` module implements …            │  ← full markdown answer
│                                                          │
│         ⬡ cs → cs.languages → …python → …python.async ▼  │  ← collapsed route pill
│                                                          │
│         (expanded) #0  cs            → cs.languages       │
│                    #1  cs.languages  → …python            │
│                    #2  …python       → …python.async      │
│                    ✓ cs.languages.python.async            │
│                    [Debug this]                           │
└──────────────────────────────────────────────────────────┘
```

| Piece | Status |
|---|---|
| `ChatPanel.tsx` (header with model + tree_id chips) | ✅ shipped |
| `MessageList.tsx` (auto-scroll on new message) | ✅ shipped |
| `MessageInput.tsx` (single-line input, button) | ✅ shipped — multi-line + Cmd+Enter is **planned** |
| `RouteSummary` collapsible pill | ✅ shipped |
| `useSendMessage()` (mock — appends user msg, fakes an assistant reply after 600 ms) | ✅ shipped |
| Cursor-style `Thinking` / `Steps` / `Answer` foldouts | **planned** — needs SSE first |
| Streaming, concurrent runs, error variant | **planned** |
| Suggested-prompts empty state | **planned** |
| Settings cog → side sheet | **planned** |

The rest of this doc describes the **target design**.

## What "Cursor-style" means here

When the agent runs, the assistant bubble in the chat is not just "..." until the answer arrives. It expands to show, in order:

1. **Thinking** — the model's reasoning (parsed from the `<reasoning>` block in our XML output, or streamed if/when we adopt a true reasoning-channel model).
2. **Tool calls** — currently none (the tree-walk is the agent's only "tool"); the slot exists for the future.
3. **Step decisions** — for each routing step: which node, which child it descended into (or stopped at), with a one-line reason. Compact; expandable to see the full prompt and raw output.
4. **Answer** — the final markdown answer.

Every part streams in as it arrives. The user can scroll back to a prior assistant message and see all of these same parts, fully — they were persisted in the run's `AgentState`.

## Anatomy of one assistant message

```
┌──────────────────────────────────────────────────────────┐
│  [ai]                                                    │
│  ▸ thinking                                              │   ← collapsible; pre-final auto-open
│    "The query is about Python's asyncio specifically..."  │
│                                                          │
│  ▸ steps  (3)                                            │   ← summary header
│    ● cs              → descend cs.languages              │
│      "Matches the languages branch"                       │
│    ● cs.languages    → descend cs.languages.python       │
│      "Python explicitly named"                            │
│    ● cs.langs.python → stop                              │
│      "Current node covers asyncio at the right level"     │
│                                                          │
│  ▾ answer                                                │
│    # Async in Python                                     │
│    Python's asyncio is a cooperative concurrency model… │
│                                                          │
│  meta:  4 LLM calls · 2.8s · 4,123 in / 612 out tokens   │
│  [open in tree overlay]  [open in debug panel]  [copy]   │
│                                                          │
│  ◀ debug target                                          │   ← visible only if this msg is the target
└──────────────────────────────────────────────────────────┘
```

The three foldouts (thinking, steps, answer) are independently collapsible. While streaming, `thinking` and `steps` are open and `answer` is collapsed; when the `final` event arrives, `answer` opens and the others collapse — but you can pop any of them back.

## Components

Current files in `frontend/src/features/chat/`:

- `ChatPanel.tsx` — composition (header + list + input)
- `MessageList.tsx` — flat list; user/assistant bubbles inline; `RouteSummary` rendered for any assistant message that has a `run_id`
- `MessageInput.tsx` — single-line `<input>` + send button (target: textarea + Cmd+Enter)
- `ConversationSidebar.tsx` — model picker, conversation list, new-conversation button
- `AgentPlaceholder.tsx` — used by the **tree editor** (`/trees/:treeId`), not the playground
- `hooks.ts` — `useSendMessage` (mock)

Target decomposition (not yet split out):

- `UserMessage.tsx`
- `AssistantMessage.tsx`
  - `ThinkingFoldout.tsx`
  - `StepsFoldout.tsx`
    - `StepLine.tsx`
  - `AnswerFoldout.tsx`
  - `MetaBar.tsx` — totals + action buttons (set debug target, open in tree, copy)

## Submit flow

> **Status: planned.** Today `useSendMessage` is a 30-line mock that adds a user message and 600 ms later adds a placeholder assistant reply (`"Backend not connected. This is a mock UI…"`). The target flow once SSE lands:

```ts
async function send(text: string) {
  chatStore.appendUser(text);
  const { user_message_id, assistant_message_id, run_id } =
    await api.postMessage({ conversation_id, text, model });
  chatStore.appendAssistantStub({ id: assistant_message_id, run_id });
  // open SSE; reducer routes events into traceStore.runs[run_id]
  subscribeEvents(run_id, (ev) => {
    traceStore.applyEvent(ev);
    if (ev.name === "final") chatStore.completeAssistant(assistant_message_id, ev.text);
  });
  // If the user wasn't actively debugging an older message, follow the live one
  if (!uiStore.debugTargetIsPinned) uiStore.setDebugTarget(run_id);
}
```

We do **not** disable the input while streaming. The user may type the next message while the current one finishes — concurrent runs are supported.

## Selecting a message to debug

**Today:** the route-summary pill under each assistant message expands to show per-step lines and a **`[Debug this]` / `[Debugging ✓]`** button. Clicking it sets `uiStore.debugTarget = message.run_id`. The tree overlay + debug panel switch immediately; a banner appears across the top.

**Planned:** clicking anywhere on the assistant bubble (not only the button), and a `◀` indicator on the targeted message inside the chat itself.

**The chat keeps streaming the *current* turn unaffected.** Inspecting message #3 while message #6 is being produced does not pause #6. (GPS analogy: looking at Tuesday's trip doesn't pause today's navigation.)

There's a subtle UX choice: should the debug target *follow* new live messages by default? We default to "follow" until the user has explicitly pinned a target. Pinned = the user clicked a specific past message. While pinned, new live messages do NOT steal focus.

A small chip near the input shows: `Debug target: msg #3 [unpin]` whenever a non-live target is pinned.

## Streaming behavior, in detail

> **Status: planned.** Mock data ships with completed runs; nothing streams today.


| Event | Effect in the assistant message bubble |
|---|---|
| `start` | Stub is already there; show a subtle spinner on the bubble |
| `step_start` | Add an in-progress `StepLine` placeholder with the node breadcrumb |
| `thinking_delta` | Append to the thinking foldout text |
| `tool_call` | Append a tool-call card (future; not rendered if empty) |
| `step` | Upsert the `StepLine` — fill in decision, latency, tokens; mark complete |
| `visit` | (no chat effect — tree-side only) |
| `answer_start` | Open the `answer` foldout (empty) |
| `answer_token` | Append text to the answer foldout markdown buffer |
| `final` | Replace answer buffer with the full text; collapse thinking/steps |
| `error` | Add an error block; if fatal, mark the bubble as failed |
| `done` | Show the meta bar with totals |

Throttle answer_token re-renders to ~20fps using a buffer that flushes on `requestAnimationFrame`.

## Multiple concurrent assistant messages

When two runs are live at once (the user submitted two queries back-to-back), two assistant bubbles are both showing live UI. They are independent — each driven by its own SSE subscription, each writing to a distinct `traceStore.runs[run_id]` entry.

The status badge in the top bar shows `streaming · 2`. The "Debug target" dropdown lists both as "Live" until they complete.

## Markdown rendering

**Today:** plain `react-markdown` with `prose prose-invert prose-sm` styling. No GFM plugin, no syntax highlight, no copy button. Mock answers include tables and fenced code blocks; tables render as raw text, code fences render unstyled.

**Planned:** the original spec —

`react-markdown` with:
- `remark-gfm` for tables, task lists.
- `rehype-highlight` for code fences.
- A custom code block renderer with a copy button.

We don't render raw HTML from the model. `disallowedElements` blocks anything dangerous.

## Empty state

**Today:** if the conversation is empty, the message list shows a single line: *"Ask a question about the knowledge tree"*. No prompts, not clickable.

**Planned:** clickable suggested prompts that submit through `useSendMessage`. The seeded mock conversations happen to answer these exact queries, so they're a natural fit:

```
Ask a question. The agent will traverse the tree and show each decision.
Pick any past message to inspect its trip on the tree or step-by-step.

Try one of:
  • How does Python's asyncio event loop work?
  • What is Dijkstra's algorithm and when should I use it?
  • Explain Rust's borrow checker
```

Suggested prompts are static for v1.

## Settings

> **Status: not built.** The only setting exposed today is the **model** picker (two pills at the top of `ConversationSidebar.tsx`: `gpt-4.1-mini`, `gpt-4o-mini`). No cog, no side sheet.

Target settings (when added):

A cog icon opens a side sheet (not a modal). Settings:
- Tree (dropdown — only one in v1 typically)
- Model (only mini models in the dropdown)
- `max_depth`, `beam_width`, `show_grandchildren`
- "Stream answer tokens" toggle
- "Auto-follow new messages with debug target" toggle (default on)

Changes apply to *the next* run.

## Why the chat is the live narration

Some agent UIs put thinking and tool calls in a separate side panel. We deliberately put them **inside** the assistant message because:

- Threading the narration through the chat keeps the conversational flow legible.
- For the chat-style debug view of any past message, we want everything in one place. If you scroll up, the thinking, the steps, and the answer are all there with the message.
- The tree-overlay view is the "spatial" view; the chat is the "linear" view. Same data, two angles.

## Error display

> **Status: planned.** No error path exists today (mock data only). When the SSE stream emits `error` with `fatal: true`, the assistant message should become an error variant:

```
[ai] ⚠ The agent stopped: parse_failed (after 2 retries).
     [Show steps]  [Show tree]
```

"Show steps" expands the steps foldout. "Show tree" sets the debug target to this run and switches the mode toggle to `tree-overlay` so you can see where the walk failed.

## Future improvements

1. **Multi-line textarea** + Cmd/Ctrl+Enter to submit + kbd hint under the input.
2. **Suggested prompts** in the empty state, wired to `useSendMessage`.
3. **Cursor-style foldouts** in the assistant bubble (thinking → steps → answer), independently collapsible. Worth doing once a real stream exists.
4. **Markdown polish** — `remark-gfm` for tables, `rehype-highlight` for code, copy-button on code blocks.
5. **Meta bar** under each assistant bubble — totals (latency, tokens) + action buttons (set debug target, open in tree, copy).
6. **`◀ debug target`** indicator on the targeted message inside the chat itself (not only in the debug panel).
7. **Error variant** for runs that fail.
8. **Settings side sheet** (cog icon) — see "Settings" above.
9. **Tree picker** in the sidebar — today the tree is hard-coded to `example-cs` via `Conversation.tree_id`.
