# Chat panel (Cursor-style streaming)

Right side of the screen. The user's input surface and the live narration of the agent's work. Modeled on modern AI coding tools (Cursor, Claude Code, Cline): the assistant message **unfolds in place** as the agent thinks, picks tools, and produces its answer.

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

- `ChatPanel.tsx` — composition
- `MessageList.tsx` — virtualized list (only past ~50 messages; v1 doesn't need it)
- `MessageInput.tsx` — textarea + send button; cmd/ctrl+enter submits
- `UserMessage.tsx` — simple bubble
- `AssistantMessage.tsx` — the rich, foldable bubble described above
  - `ThinkingFoldout.tsx`
  - `StepsFoldout.tsx`
    - `StepLine.tsx`
  - `AnswerFoldout.tsx`
  - `MetaBar.tsx` — totals + action buttons (set debug target, open in tree, copy)

## Submit flow

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

Clicking the meta bar's `[set as debug target]` (or just clicking the assistant message bubble) sets `uiStore.debugTarget = message.run_id`. The selected message gets a `◀` indicator; the tree overlay and the debug panel switch to that run.

**The chat keeps streaming the *current* turn unaffected.** Inspecting message #3 while message #6 is being produced does not pause #6. (GPS analogy: looking at Tuesday's trip doesn't pause today's navigation.)

There's a subtle UX choice: should the debug target *follow* new live messages by default? We default to "follow" until the user has explicitly pinned a target. Pinned = the user clicked a specific past message. While pinned, new live messages do NOT steal focus.

A small chip near the input shows: `Debug target: msg #3 [unpin]` whenever a non-live target is pinned.

## Streaming behavior, in detail

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

`react-markdown` with:
- `remark-gfm` for tables, task lists.
- `rehype-highlight` for code fences.
- A custom code block renderer with a copy button.

We don't render raw HTML from the model. `disallowedElements` blocks anything dangerous.

## Empty state

Before the first user message:

```
Ask a question. The agent will traverse the tree and show each decision.
Pick any past message to inspect its trip on the tree or step-by-step.

Try one of:
  • How does Python's asyncio event loop work?
  • What is RAII in Rust?
  • What's the difference between TCP and UDP?
```

Suggested prompts are static for v1.

## Settings

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

If the SSE stream emits `error` with `fatal: true`, the assistant message becomes an error variant:

```
[ai] ⚠ The agent stopped: parse_failed (after 2 retries).
     [Show steps]  [Show tree]
```

"Show steps" expands the steps foldout. "Show tree" sets the debug target to this run and switches the mode toggle to `tree-overlay` so you can see where the walk failed.
