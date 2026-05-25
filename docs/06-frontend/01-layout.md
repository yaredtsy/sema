# UI layout

A single screen with three regions, designed around the GPS-history metaphor: the **map** (tree), the **trip details** (debug panel), and the **conversation** (chat). The playground lives at `/playground`; tree CRUD lives at `/` and `/trees/:treeId`.

> **Status — experimental.** The playground is a debugging surface for the agent, not a polished end-user product. It runs entirely on mock data today (`frontend/src/data/mockData.ts`) — two seeded conversations and five completed runs, no backend wiring. Layout and components below describe the *intended* shape; what's actually shipping is summarized in the snapshot below and called out per-section.

## What's built today

```
┌────────────┬──────────────────────────────┬──────────────────┬───────────────────┐
│ Sidebar    │      Tree (React Flow v12)   │   Debug Panel    │  Chat             │
│            │                              │                  │                   │
│ brand      │   ● cs ─┬─ ● langs ✓         │ [Step v|Tree o]* │  model · tree_id  │
│ model      │         │   ├─ ● python ✓◀   │ ──────────────── │ ────────────────  │
│ + new conv │         │   │   └─ ● async ✓ │ Debug target —   │  [user]  q1       │
│ conv list  │         │   └─ ○ rust        │  • run-01  ✓     │  [ai]   answer 1 │
│ run-count  │         └─ ○ algorithms ✓    │  • run-02  ✓     │   ⬡ cs → langs…  │
│ badges     │                              │  • run-03  ✓     │  [user]  q2       │
│ ─────────  │  legend chips + minimap +    │ ──────────────── │  [ai]   answer 2 │
│ "mock data │  controls                    │ run meta + steps │  > _              │
│  no       "│                              │ + final answer   │                   │
└────────────┴──────────────────────────────┴──────────────────┴───────────────────┘
       *Step v / Tree o toggle is currently a no-op (`uiStore.debugMode` has no consumers).
```

A thin **"Debugging: …" banner** appears across the top when a target is set (it is the only thing currently rendered above the columns — there is no real top bar yet).

| Region | Implemented | Planned |
|---|---|---|
| Sidebar (conversations) | brand, model pills, conversation list, run-count badges, new-conv button | rename / delete a conversation, tree picker |
| Tree (map) | React Flow v12 dendrogram, visited / cursor / step highlights, legend chips, MiniMap + Controls | step-index badges, hover tooltip, inspector card on node click, edge animation on `visit` |
| Debug panel | message-selector list, run metadata, expandable step cards, final-answer summary | wire the mode toggle (or repurpose), scrubber for completed runs, filter / search, export JSON |
| Chat | bubbles, route-summary pill per assistant message, single-line input | Cursor-style streaming foldouts (thinking / steps / answer), textarea + Cmd+Enter, suggested prompts |
| Top bar | thin "Debugging: …" banner only | tree dropdown, conversation id, status pill, settings cog |

## Wireframe (desktop, ≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Tree: cs ▼  │  Conv: 01HQT…  │  Debugging: msg #3 ▼  Mode: tree ⇄ chat  ●live │  (top bar)
├──────────────────────────────────┬────────────────────────┬─────────────────────┤
│                                  │                        │                     │
│       Tree view  (the map)       │   Debug panel          │   Chat panel        │
│                                  │  (trip details)         │  (conversation)    │
│                                  │                        │                     │
│   ● cs ─┬─ ● langs ✓             │  Target: msg #3        │  [user] q1          │
│         │   ├─ ● python ✓ ◀cur   │  Mode: tree-overlay    │  [ai]  ▶ thinking   │
│         │   │   └─ ● async ✓     │                        │        ● step 0     │
│         │   └─ ○ rust            │  Step 0  cs            │        ● step 1     │
│         └─ ○ frame                │  → descend cs.langs   │        ● answer ✓   │
│                                  │  ──────────────────    │  [user] q2          │
│   (overlay reflects the selected │  Step 1  cs.langs      │  [ai]  ▶ thinking   │
│    message; click visited nodes  │  → descend python      │        ● step 0     │
│    to inspect step detail)       │  ──────────────────    │        ● answer ✓ ◀│
│                                  │  Step 2  …python       │  [user] q3          │
│                                  │  → stop                │  [ai]  live...      │
│                                  │  ──────────────────    │                     │
│                                  │  answer: leaf          │  > _                │
└──────────────────────────────────┴────────────────────────┴─────────────────────┘
```

The arrow `◀` on a chat message marks the **current debug target**. Click any past assistant message to change the target — both the tree overlay and the debug panel snap to that run.

## Region sizes

**Today:** sidebar `w-56` (collapsible to 0 via a thin pull-tab), tree `flex-1`, debug `w-80` fixed, chat `w-96` fixed. The layout assumes ≥ 1280 px.

**Planned:**

- **Tree** — `flex-grow 1`, min `480px`.
- **Debug panel** — `360px`, collapsible to `0`.
- **Chat** — `380px`, resizable `320–560px`.

Below `1280px` the debug panel collapses by default. Below `1024px` chat stacks under the tree. Widths persist to `localStorage` via `uiStore`.

## Top bar — planned

> **Status: not built.** Only a one-line `<DebugBanner />` (showing the active debug target + a "clear" button) appears today. The full top bar described below is the intended direction.

A single row showing:
- **Current tree** (dropdown if multiple loaded)
- **Conversation id** (clickable → copy)
- **Debug target** — dropdown listing assistant messages in the conversation, prefilled with the currently selected one. "Live" if a run is streaming and is also the target.
- **Mode toggle** — `tree-overlay` ⇄ `chat-style` (controls how the debug target is visualized; both work simultaneously, this just controls which is *emphasized*)
- **Status badge** — `idle` / `streaming` / `replay` / `error`
- **Settings cog** — opens a side sheet (model, params)

## Region responsibilities

| Region | Reads | Writes |
|---|---|---|
| Sidebar | `chatStore`, `traceStore.runs` (badge counts) | `chatStore.activeConversationId/model`, clears `uiStore.debugTarget` on switch |
| Tree | `traceStore.runs[debugTarget]`, `uiStore.selectedNodeId/selectedStepIdx` | `uiStore.selectedNodeId` (click) |
| Debug panel | `traceStore.runs[debugTarget]`, `uiStore.debugMode`, `uiStore.selectedStepIdx`, `chatStore.messages()` | `uiStore.debugTarget`, `uiStore.debugMode`, `uiStore.selectedStepIdx` |
| Chat | `chatStore`, `traceStore.runs[*]`, `useSendMessage()` | `chatStore`, `uiStore.debugTarget` via per-message "Debug this" action |

**Single source of truth: `uiStore.debugTarget`.** A run id string (or `null` today; will accept `"live"` once streaming lands). Every component that visualizes "the currently debugged trip" reads this and re-derives.

> **Caveat:** `uiStore.debugMode` is set by the toggle in the debug panel but no other component consumes it. The toggle is effectively a no-op. Cheapest fix is to repurpose it as an **"auto-pan tree to selected step"** toggle so it controls something real.

## Cross-region wiring

**Today:**

- Click **"Debug this"** inside an assistant bubble (or pick from the debug-panel selector) → `uiStore.setDebugTarget(run_id)` → banner appears, tree overlay + debug panel switch.
- Click a **step card** → `uiStore.setSelectedStepIdx(idx)` → that node gets a violet ring on the tree.
- Click a **node** on the tree → `uiStore.setSelectedNodeId(id)`. No panel reaction yet.
- Switch conversation in sidebar → clears the debug target.

**Planned:**

- Click a **visited node** in the tree → opens that node's step detail in the debug panel (the "inspector card" in [05-tree-overlay-debug.md](./05-tree-overlay-debug.md)).
- Tree auto-pans / centers to selected step (currently the tree is static after `fitView`).

## State machines per region

| State | Tree | Debug panel | Chat |
|---|---|---|---|
| Boot | skeleton (3 fake nodes) | "no message selected" | input ready, send enabled |
| Conversation empty, idle | tree loaded, no overlay | "send a message to start" | input ready |
| Query sent | tree dims; target = new assistant message | step cards begin appearing | new assistant bubble appears as "thinking" |
| Step arrives | corresponding node highlights | step card upserts (or fills in from "in-progress") | inline step item appears under the assistant bubble |
| Final arrives | last cursor highlighted | "answer" marker; mode toggle now valid | assistant content = the final markdown |
| Past message clicked | overlay snaps to that run's visited nodes | step cards replaced with that run's | clicked message gets the `◀` indicator |
| Concurrent runs | overlay reflects the *target*, not the most recent | reflects target | multiple assistant bubbles can be live |
| Run errors | tree marks the last visited node with an error badge | red step card at the failure point | error indicator on that assistant bubble |

## Empty state (first paint)

**Today:** the seeded conversation has messages in it, so first paint already shows populated bubbles. If the conversation is empty, the chat shows: *"Ask a question about the knowledge tree"* (a one-liner — no suggested prompts yet). A hint along the tree's bottom reads *"Select a message to debug → route lights up"* whenever no debug target is set.

**Planned:** the tree shows fully, with no overlay. The chat shows a hint: *"Ask a question. The agent will traverse the tree — pick any past message to debug its trip."* Two or three clickable suggested prompts that submit through `useSendMessage`.

## Color / theme

Dark mode default. Tailwind `slate-950` body, `slate-100` text. Specific palette in `tailwind.config.js`. Colors actually used today:

| Meaning | Color (Tailwind) |
|---|---|
| Visited (in debug target) | `sky-500` border, `sky-950/60` fill |
| Cursor (final cursor of the run) | `amber-400` border, `amber-950/60` fill |
| Selected step | `violet-400` border, `violet-950/60` fill + ring |
| Selected node (user click, no debug) | `slate-400` border |
| Idle node | `slate-700` border, `slate-900` fill |
| Decision `descend` / `answer` / `stay` | `sky` / `emerald` / `slate` |
| Confidence ≥ 90 / ≥ 70 / < 70 | `emerald-400` / `amber-400` / `red-400` |
| Debug target banner | `violet-500…950` |
| Error | `rose` (planned, no error state today) |

> **Accessibility gap:** color is currently the only signal for visited / cursor / step. To match the spec we still need non-color companions — step-index badges on nodes, dashed borders for "considered" siblings, a rose stripe for errors. Listed in **Future improvements** below.

## Why three regions, not tabs

Tabs hide context. The whole pitch is *seeing the agent's trip on the map while reading the turn-by-turn list while continuing the conversation*. None of those should be hidden behind a click.

## Things intentionally not in v1

- Two trees side-by-side
- Diff mode (run-vs-run on two messages)
- Multi-conversation tabs (we use a sidebar instead, already shipped)
- A node editor surface inside the playground (lives at `/trees/:treeId` instead)

Each has a slot in this layout if/when needed.

## Future improvements (prioritized backlog)

This is the recommended next round of work on the playground. Each item is small enough to do in one sitting; together they close the gap between the design above and the experimental UI shipping today.

1. **Wire or replace `debugMode`** — currently inert. Cheapest win: turn it into an "auto-pan tree to selected step" toggle.
2. **Top bar (minimal)** — brand · tree name · conversation id · status pill (`idle` / `debugging`). Even a basic version anchors the page.
3. **Step-index badges on visited tree nodes** — `0/1/2…` corner badges. Doc-spec'd, accessibility-friendly companion to color.
4. **Suggested-prompts empty state** in chat, wired to `useSendMessage`.
5. **Multi-line textarea input + Cmd+Enter + kbd hint** — replaces the current single-line `<input>`.
6. **Keyboard shortcuts** — `j/k` (next/prev step), `[/]` (cycle messages), `Esc` (clear target), `f` (fit tree), `c` (center on selected step). Add a `?` cheat-sheet overlay.
7. **Compact message-selector dropdown** — the current list eats vertical space in the debug panel.
8. **Scrubber for completed runs** — slider that drives `selectedStepIdx`; tree dims steps after the cursor.
9. **Node hover tooltip** — always show `description`; when a debug target is active, append `step N · descended → X · 410ms`.
10. **Resizable column handles + `localStorage` persistence** for sidebar / debug / chat widths.
11. **Cursor-style streaming foldouts** in assistant bubbles (thinking / steps / answer) — the design described in [03-chat-panel.md](./03-chat-panel.md). Worth doing once a real SSE stream exists.
12. **Inspector card on tree-node click** — see [05-tree-overlay-debug.md](./05-tree-overlay-debug.md). Today node clicks set `selectedNodeId` but nothing renders.
13. **Filter / search in the step list** (`steps only`, `errors only`, free-text on `node_id` / reasoning).
14. **Export run as JSON** — one button on the debug panel.
