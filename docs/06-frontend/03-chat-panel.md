# Chat panel

Right side of the screen. The user's only input surface. v1 is **single-turn per run** — each user message kicks off a fresh agent run. We will add multi-turn later when we know what state to carry.

## Anatomy

```
┌──────────────────────────────┐
│  Chat                        │  ← header, run status badge
├──────────────────────────────┤
│  [user] How does asyncio …   │
│  ─────────────────────────   │
│  [ai]   tracing on tree …    │  ← live status row while streaming
│         (visiting: cs.langs) │
│  [ai]   # Async in Python …  │  ← rendered markdown when final arrives
│  ─────────────────────────   │
│  [user] Another question?    │
│  ...                         │
├──────────────────────────────┤
│  > type your question  [↵]   │  ← input
│  model: gpt-4.1-mini | depth:5│  (read-only summary; settings via cog)
└──────────────────────────────┘
```

## Components

- `ChatPanel.tsx` — composition
- `MessageList.tsx` — virtualized list (only when > 50 messages; not v1)
- `MessageBubble.tsx` — one message: user, assistant, system, error variants
- `LiveStatusRow.tsx` — visible only while a run is streaming; shows current cursor + last decision in human form
- `MessageInput.tsx` — textarea + send button; cmd/ctrl+enter submits

## Submit flow

```ts
async function send(text: string) {
  if (currentRun.status === "streaming") return;  // gate
  chatStore.append({ role: "user", text });
  chatStore.append({ role: "assistant", text: "", status: "starting" });
  const { run_id } = await api.postQuery({ tree_id, query: text, model });
  traceStore.beginRun(run_id);
  subscribeEvents(run_id, handleEvent);
}
```

`handleEvent` dispatches into both `traceStore` (for steps / cursor) and `chatStore` (for `final` text and status changes).

We do *not* disable the input while streaming — but `send` is gated so the second submit is a no-op. The UI shows a subtle "agent is thinking" hint. We considered hard-disabling and decided against it because the user may want to type the next question while the current one finishes.

## Live status row

While the SSE stream is open:

```
[ai]  visiting cs.languages.python   →  descend "Async in Python"
```

This is **derived from the trace store**, not stored separately. Updates on every `step` or `visit` event. When `final` arrives, the row is replaced by the rendered markdown answer.

## Markdown rendering

`react-markdown` with:
- `remark-gfm` for tables, task lists.
- `rehype-highlight` for code fences (with a small theme set in `index.css`).
- A custom `code` renderer that adds a copy button.

We do **not** render raw HTML from the model. `disallowedElements` blocks anything dangerous.

## Error display

If the SSE stream emits `error` with `fatal: true`, the assistant message becomes an error variant:

```
[ai] ⚠ The agent stopped: parse_failed (after 2 retries).
     [Show details]
```

"Show details" opens the trace panel and scrolls to the step that failed.

## Settings

A cog icon opens a side sheet (not a modal — modals interrupt). Settings:
- Tree (dropdown of loaded trees)
- Model (only mini models in the dropdown; non-mini are not selectable — see [04-tech-stack.md](../00-overview/04-tech-stack.md))
- `max_depth`, `beam_width`, `show_grandchildren`
- "Stream answer tokens" toggle

Changes apply to the next query, never retroactively.

## Empty state

Before the first message:

```
Ask a question. The agent will traverse the tree and show you each decision.

Try one of:
  • How does Python's asyncio event loop work?
  • What is RAII in Rust?
  • What's the difference between TCP and UDP?
```

Suggested prompts are tree-aware (only shown if the current tree has nodes whose titles loosely match). Static for v1.

## Multi-turn (out of scope, but where it slots in)

When we add multi-turn:
- `chatStore.messages` already carries the whole history; we will start passing it to the answer prompt as conversation context.
- Each user turn still spawns a fresh run with its own cursor — the tree-walk part is per-turn.
- The state of the *last* cursor becomes the starting cursor of the next run (a "warm start") — to be evaluated.

We will write a separate doc when we get there.
