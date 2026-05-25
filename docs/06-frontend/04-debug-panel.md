# Debug panel — the GPS-history surface

The middle column. The single most important piece of UI in the project. It is the surface where you **pick which trip to inspect** and **see its turn-by-turn detail**.

The chat-style debug view (inline in the chat) and the tree-overlay debug view (on the map) are *peer renderings* of the same underlying state, and the debug panel is what binds them — it owns the **debug target** and the **mode toggle**.

> **Status — experimental.** Core works: message selector, expandable step cards (thinking / decision / messages_in / raw output / metrics), final-answer summary. Missing: a working **mode toggle** (it's wired into state but no other component reads `uiStore.debugMode`, so it's effectively decorative), a **scrubber** for completed runs, **live mode**, **filter/search**, and **export**. There's also no keyboard nav. Everything below describes the intended shape; current quirks are flagged inline.

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

1. **Message selector** (the debug target). **Today:** rendered as a vertical list of buttons under a `Debug target — pick a message` header. **Planned:** compact dropdown to free up vertical space, with `[live]` and per-status badges.
2. **Mode toggle** — `Step view` ⇄ `Tree overlay`. **Today: no-op** — `uiStore.debugMode` is written by this toggle but no consumer reads it. **Planned:** focus hint as below (controls emphasis + where keyboard shortcuts route). A cheaper repurpose is to turn it into an **"auto-pan tree to selected step"** toggle.
3. **Step list** — shipped today: cards for each `TraceStepFull` entry from the mock data (one per routing decision). Future event kinds (`step_start`, `thinking_delta`, `tool_call`, `answer_start`, `answer_token`, `final`, `done`, `error`) are **planned** for when SSE lands.
4. **Final answer block** — shipped today (`AnswerSection`) — green-bordered panel under the steps showing first 280 chars of `final_answer` plus `in/out/latency/model`. **Planned:** expand/collapse, full markdown.
5. **Scrubber** — **planned, not built**. When ready, dragging steps through will drive both the tree overlay and any other visualization.

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

**Today:** a vertical list of buttons under "Debug target — pick a message". Each button shows the run id (mono), a status pill, the step count, and the (truncated) original user query. Clicking toggles `uiStore.debugTarget`. There is no "live" entry, no auto-follow, no `debugTargetIsPinned` flag — these will land with SSE.

```
Debug target — pick a message
[ run-01  ✓completed  3 steps  ]
   How does Python's asyncio event loop work?
[ run-02  ✓completed  2 steps  ]
   What is Dijkstra's algorithm and when should I use it?
[ run-03  ✓completed  3 steps  ]   ← currently selected (violet)
   Explain Rust's borrow checker
```

**Planned (target shape — a dropdown):**

```
[▼] msg #3 — "How does Python's asyncio…"           ● completed
    msg #2 — "And what about gather() specifically?" ● completed
    msg #1 — "Compare to threading."                ● live
    "Live (auto-follow new messages)"
```

Choosing "Live (auto-follow)" sets `uiStore.debugTargetIsPinned = false`; any new live run becomes the target. Choosing a specific message sets it pinned.

Keyboard: `⌘[` / `⌘]` cycle through messages. `⌘0` returns to live-follow. — **planned**.

This is also reachable from inside the chat (the per-message `[Debug this]` button — already shipped). Both update the same `uiStore.debugTarget`.

## The step list, in detail

Each entry is a self-contained `StepCard`. The shipping shape (`features/trace/StepCard.tsx`):

- **Header (always visible)** — `#step_idx`, `node_id`, a kind badge (`descend` / `answer` / `stay`, color-coded), and a `confidence` % in green/amber/red.
- **Expanded body** (when the card is the selected step):
  - **💭 Thinking** foldout — the parsed `<reasoning>` text in italics.
  - **Decision** card — `decision.reasoning` plus `→ child_id` if any.
  - **📨 Prompt (N messages)** foldout — the `messages_in` chat messages, with role labels; long content is truncated at 400 chars.
  - **📤 Raw output** foldout — the LLM's raw XML output.
  - **Metrics line** — `in: …  out: …  Nms`.

Clicking a card toggles `uiStore.selectedStepIdx`. The tree overlay then puts a violet ring on that step's node. **Planned:** tree also auto-pans/centers, and chat-style mode scrolls the chat to the matching `StepLine` inside the assistant bubble.

> **Future event kinds** (`step_start`, `thinking_delta`, `tool_call`, `answer_start`, `answer_token`, `final`, `error`, `done`) — not modeled today; mock runs only carry completed `step` entries. The card structure above is forward-compatible.

## Modes — chat-style vs tree-overlay

> **Status: toggle exists but is inert.** The UI shows two pills (`Step view` ⇄ `Tree overlay`), they toggle `uiStore.debugMode`, but nothing reads it. The chat-side route summary always renders; the tree overlay always renders; the keyboard hooks don't exist yet. Two reasonable resolutions:
>
> 1. **Wire it** as described below (focus hint + keyboard routing).
> 2. **Repurpose** it as an **"auto-pan tree to selected step"** toggle so it does something load-bearing immediately.

The toggle does NOT hide either view. Both views are always rendered (chat-style inside the chat, tree-overlay on the tree). The toggle controls **emphasis + keyboard focus**:

| Mode | Visual emphasis | Keyboard targets | Use when |
|---|---|---|---|
| `chat-style` | Debug panel + assistant bubble scroll-sync | `j`/`k` walk steps in the chat | Reading the narrative in order, like a transcript |
| `tree-overlay` | Debug panel + tree-side highlights/animations | `j`/`k` walk steps and pan the tree | Studying the *shape* of the walk — depth, branching, where it went wrong |

A user can switch freely. The state (which step is selected) is shared between modes.

## Live vs replay

> **Status: planned.** Today only completed mock runs exist; there's no live mode, no scrubber. The shape below is what we want once SSE lands.


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

> **Status: planned.**

A small toolbar lets you:
- Filter the step list (`steps only`, `thinking only`, `errors only`, `all`).
- Search step text (matches against `node_id`, `decision.reasoning`, raw output).

Cheap to add once the list exists; useful when traces grow to 10+ steps.

## Concurrent runs

> **Status: planned.** Requires real streaming first.

When several runs are live at once, the debug panel shows the *target*'s run, not all of them. Other live runs appear faintly in the message selector with a `(live)` badge; switching the selector switches the panel.

## Export

> **Status: planned.**

A button: `[Export this run as JSON]` calls `GET /runs/{run_id}` and downloads it. Saved files reproduce the exact debug view if re-imported via `POST /conversations/import` (or rendered ad-hoc from a paste-in textarea — future).

## Keyboard

> **Status: planned, not built.** None of these are wired today.

| Key | Action |
|---|---|
| `j` / `k` | Next / previous step |
| `g g` / `G` | First / last step |
| `o` | Toggle mode (chat-style ⇄ tree-overlay) |
| `r` | Toggle live ⇄ replay (if at the tip of a completed run, this just toggles the scrubber visibility) |
| `⌘[` / `⌘]` | Previous / next message in the conversation as the debug target |
| `⌘0` | Live-follow (most recent live run becomes target as soon as it starts) |
| `e` | Export current run |
| `Esc` | Clear debug target |

## Why this is the centerpiece

This panel is what makes the GPS-history metaphor real. Without it, you have a chat. With it, you have:
- A persistent record of every trip.
- A pivot point — pick any trip; see its detail.
- Two synchronized views (tree-overlay and chat-style) that share a single source of truth.

Everything else (the tree, the chat, the agent itself) is in service of what happens here.

## Future improvements

1. **Decide what `debugMode` does** — wire it (focus hint + keyboard routing) or repurpose it (e.g., "auto-pan tree to selected step"). It is the only inert control in the panel today.
2. **Compact dropdown message selector** in the header — frees up vertical space for the step list.
3. **Scrubber for completed runs** — slider below the run-meta row that drives `selectedStepIdx`. Tree overlay should dim steps after the cursor.
4. **Visual confidence bar** in the `StepCard` header (replaces the bare `%`).
5. **Expandable final-answer block** with full markdown render (currently `slice(0, 280)`).
6. **Keyboard nav** — `j`/`k`/`gg`/`G`/`Esc`/`⌘[`/`⌘]` as per the table above. Add a `?` cheat-sheet.
7. **Live mode** — once SSE lands: in-progress step placeholders, current-cursor pulse, auto-focus newest step unless the user has manually clicked one.
8. **Filter / search** in the step list.
9. **Export run as JSON** — one button.
10. **Inline diff between two runs** (stretch) — pick two messages, see where the routes diverged.
