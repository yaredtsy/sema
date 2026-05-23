# Debug panel — the GPS-history surface

The middle column. The single most important piece of UI in the project. It is the surface where you **pick which trip to inspect** and **see its turn-by-turn detail**.

The chat-style debug view (inline in the chat) and the tree-overlay debug view (on the map) are *peer renderings* of the same underlying state, and the debug panel is what binds them — it owns the **debug target** and the **mode toggle**.

## Anatomy

```
┌───────────────────────────────────────────────┐
│  Debug                                        │   header
├───────────────────────────────────────────────┤
│  Target:  msg #3                       ▼      │   ← message selector
│           "How does Python's asyncio…"        │
│  Mode:    [chat-style]   [tree-overlay]       │   ← view toggle
│  Status:  ● completed · 4 steps · 2.8s        │
├───────────────────────────────────────────────┤
│  ▸ step_start  cs                              │
│  ▸ thinking    "Matches the languages branch" │
│  ▾ step 0      cs → descend cs.languages      │  ← selected
│      messages_in (system, user)               │     [show all]
│      raw output                                │     [show]
│      decision: descend · 88% · 410ms          │
│      tokens:   932 / 64                        │
│  ▸ visit       cs.languages, depth 1          │
│  ▸ step 1      cs.languages → descend python   │
│  ▸ step 2      …python → stop                  │
│  ▸ answer      cs.languages.python, 1.2s      │
│  ▸ done        totals…                         │
├───────────────────────────────────────────────┤
│  [Replay ◀ ●●●●○ ▶]   step 0 of 4              │   ← scrubber (replay mode)
└───────────────────────────────────────────────┘
```

## What lives here

1. **Message selector** (the debug target) — dropdown listing assistant messages from the current conversation. The selected message's `run_id` becomes `uiStore.debugTarget`.
2. **Mode toggle** — `chat-style` vs `tree-overlay`. This is a *focus hint*, not a hard switch. Both renderings exist at all times; the toggle controls which one is emphasized and where keyboard shortcuts route.
3. **Step list** — the trip's turn-by-turn breakdown. Cards for `step_start`, `thinking`, `step`, `visit`, `answer_start`, `answer_token` (collapsed in a buffer), `final`, `done`, `error`.
4. **Scrubber** — when not live, you can drag through steps; the tree overlay and any visualizations sync to the scrubbed step.

## Data dependencies

```
uiStore.debugTarget  ─── run_id (or "live") ─┐
                                             ▼
                              traceStore.runs[run_id]  (RunState — events reduced)
                                             │
   ┌─────────────────────────────────────────┴───────────────────────────┐
   ▼                                                                     ▼
chat-style view (in ChatPanel.AssistantMessage)               tree-overlay (in TreePanel)
                                             ▲
                                             │
                              uiStore.selectedStep, uiStore.debugMode
```

The debug panel doesn't store domain data — it composes `traceStore.runs[debugTarget]` with `ui` state.

## Message selector

A dropdown that lists every assistant message in the conversation, most recent first:

```
[▼] msg #3 — "How does Python's asyncio…"           ● completed
    msg #2 — "And what about gather() specifically?" ● completed
    msg #1 — "Compare to threading."                ● live
    "Live (auto-follow new messages)"
```

Choosing "Live (auto-follow)" sets `uiStore.debugTargetIsPinned = false`; any new live run becomes the target. Choosing a specific message sets it pinned.

Keyboard: `⌘[` / `⌘]` cycle through messages. `⌘0` returns to live-follow.

This is also reachable from inside the chat (click an assistant message's `[debug]` button). Both update the same `uiStore.debugTarget`.

## The step list, in detail

Each entry is a self-contained `StepCard`:

- **Header** — kind (`step_start`, `step`, `visit`, `thinking`, `tool_call`, `answer_start`, `final`, `error`, `done`), step index, summary.
- **Body** — visible without expansion:
  - For `step`: `node → action target`, one-line reasoning.
  - For `thinking`: the reasoning text (first 200 chars; expand for more).
  - For `tool_call`: tool name + arg preview.
  - For `final`: stop_reason + cursor.
- **Foldouts** (collapsed by default):
  - `messages_in` — the chat messages we sent to the LLM at this step, rendered as compact chat bubbles. Truncated previews; "show full" hits `GET /runs/{id}/steps/{idx}` lazily.
  - `raw_output` — the LLM's raw text.
  - `parsed` — the structured decision (and confidence).
  - `metrics` — latency, tokens, model.

Clicking a card sets `uiStore.selectedStep = idx`. In tree-overlay mode the tree centers on that step's node + highlights it; in chat-style mode the chat scrolls to the matching `StepLine` inside the assistant bubble.

## Modes — chat-style vs tree-overlay

The toggle does NOT hide either view. Both views are always rendered (chat-style inside the chat, tree-overlay on the tree). The toggle controls **emphasis + keyboard focus**:

| Mode | Visual emphasis | Keyboard targets | Use when |
|---|---|---|---|
| `chat-style` | Debug panel + assistant bubble scroll-sync | `j`/`k` walk steps in the chat | Reading the narrative in order, like a transcript |
| `tree-overlay` | Debug panel + tree-side highlights/animations | `j`/`k` walk steps and pan the tree | Studying the *shape* of the walk — depth, branching, where it went wrong |

A user can switch freely. The state (which step is selected) is shared between modes.

## Live vs replay

When `debugTarget == runId` and that run is still streaming, the panel is in **live** mode:
- The step list grows as events arrive.
- The scrubber is hidden (you're at the tip).
- Newest step is auto-focused unless the user has manually clicked one.

When `debugTarget` points to a completed run:
- The step list is fully populated (rendered from the saved `AgentState`).
- The scrubber appears: `◀ ●●●●○ ▶`.
- Scrubbing changes `uiStore.selectedStep` and `uiStore.replayCursorAt(stepIdx)`.
- The tree overlay reflects "what the tree looked like at that step" — only nodes visited up to that step are highlighted.

The transition from live to replay is automatic: when `done` arrives and `runState.status == "completed"`, the same render becomes scrubbable. No mode flip, no re-fetch.

## Replay reducer

Replay is a derived view. Given `runState` and `replayIndex`:

```ts
const cursorIdAt = (i: number) => runState.visited_ids[i] ?? runState.visited_ids.at(-1);
const visitedIdsAt = (i: number) => runState.visited_ids.slice(0, i + 1);
const stepAt = (i: number) => runState.trace[i];
const isLatest = (replayIndex ?? runState.trace.length - 1) === runState.trace.length - 1;
```

Components subscribe to these selectors. When `replayIndex` is `null` (live tip), they read the latest. When set, they read at that index.

## Filtering and search

A small toolbar lets you:
- Filter the step list (`steps only`, `thinking only`, `errors only`, `all`).
- Search step text (matches against `node_id`, `decision.reasoning`, raw output).

Cheap to add once the list exists; useful when traces grow to 10+ steps.

## Concurrent runs

When several runs are live at once, the debug panel shows the *target*'s run, not all of them. Other live runs appear faintly in the message selector with a `(live)` badge; switching the selector switches the panel.

## Export

A button: `[Export this run as JSON]` calls `GET /runs/{run_id}` and downloads it. Saved files reproduce the exact debug view if re-imported via `POST /conversations/import` (or rendered ad-hoc from a paste-in textarea — future).

## Keyboard

| Key | Action |
|---|---|
| `j` / `k` | Next / previous step |
| `g g` / `G` | First / last step |
| `o` | Toggle mode (chat-style ⇄ tree-overlay) |
| `r` | Toggle live ⇄ replay (if at the tip of a completed run, this just toggles the scrubber visibility) |
| `⌘[` / `⌘]` | Previous / next message in the conversation as the debug target |
| `⌘0` | Live-follow (most recent live run becomes target as soon as it starts) |
| `e` | Export current run |

## Why this is the centerpiece

This panel is what makes the GPS-history metaphor real. Without it, you have a chat. With it, you have:
- A persistent record of every trip.
- A pivot point — pick any trip; see its detail.
- Two synchronized views (tree-overlay and chat-style) that share a single source of truth.

Everything else (the tree, the chat, the agent itself) is in service of what happens here.
