# UI layout

A single screen with three regions, designed around the GPS-history metaphor: the **map** (tree), the **trip details** (debug panel), and the **conversation** (chat). No routing in v1.

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

- **Tree** — `flex-grow 1`, min `480px`.
- **Debug panel** — `360px`, collapsible to `0`.
- **Chat** — `380px`, resizable `320–560px`.

Below `1280px` the debug panel collapses by default. Below `1024px` chat stacks under the tree. Widths persist to `localStorage` via `uiStore`.

## Top bar

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
| Tree | `useTree(tree_id)`, `traceStore.runs[debugTarget]`, `uiStore.selectedNode` | `uiStore.selectedNode` (click) |
| Debug panel | `traceStore.runs[debugTarget]`, `uiStore.debugMode`, `uiStore.selectedStep` | `uiStore.selectedStep`, `uiStore.debugTarget` |
| Chat | `chatStore.messages`, `traceStore.runs[*]`, `useSendQuery()` | `chatStore`, `uiStore.debugTarget` (on message click), kicks new runs |

**Single source of truth: `uiStore.debugTarget`.** A run id string (or `"live"`). Every component that visualizes "the currently debugged trip" reads this and re-derives.

## Cross-region wiring

- Click an **assistant message** in chat → `uiStore.setDebugTarget(message.run_id)` → tree overlay + debug panel switch.
- Click a **step card** in the debug panel → `uiStore.setSelectedStep(idx)` → tree centers on that step's node + highlights it.
- Click a **visited node** in the tree → if a debug target is set, opens that node's step detail in the debug panel.

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

## Empty state (first paint, no messages yet)

The tree shows fully, with no overlay. The chat shows a hint: *"Ask a question. The agent will traverse the tree — pick any past message to debug its trip."* Two or three suggested prompts.

## Color / theme

Dark mode default. Tailwind `slate-900` background, `slate-100` text. Specific palette in `tailwind.config.js`. Color codes used:

| Meaning | Color |
|---|---|
| Visited (in debug target) | medium slate + faint border |
| Current cursor (live runs) | emerald ring |
| Selected step in debug | sky ring |
| Concurrent live run, not the target | thin violet underline |
| Error | rose |

Accessibility: no information conveyed by color alone. The current node also carries a ring; visited nodes also get a dot indicator.

## Why three regions, not tabs

Tabs hide context. The whole pitch is *seeing the agent's trip on the map while reading the turn-by-turn list while continuing the conversation*. None of those should be hidden behind a click.

## Things intentionally not in v1

- Two trees side-by-side
- Diff mode (run-vs-run on two messages)
- A node editor surface
- Multi-conversation tabs

Each has a slot in this layout if/when needed.
