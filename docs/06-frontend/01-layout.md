# UI layout

The frontend is a single screen with three regions. No routing in v1 (no second page exists).

## Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ▼ Tree: cs ┃ Run: 01HQX…  Model: gpt-4.1-mini   Status: ●streaming        │  (top bar)
├──────────────────────────────────┬──────────────────────┬──────────────────┤
│                                  │                      │                  │
│         Tree visualization       │      Trace panel     │   Chat panel     │
│         (React Flow)             │     (collapsible)    │                  │
│                                  │                      │                  │
│  ● cs ─┬─ ● langs ◀ (current)    │  Step 0  cs          │  [user] question │
│        │   ├─ ○ python  (next)   │  → descend           │  [ai]   ...      │
│        │   └─ ○ rust             │     "matches python" │                  │
│        └─ ○ frameworks            │  Step 1  cs.langs    │                  │
│                                  │  → descend python    │                  │
│                                  │  Step 2  …python      │                  │
│                                  │                      │                  │
│                                  │                      │  > type here _   │
└──────────────────────────────────┴──────────────────────┴──────────────────┘
```

## Region sizes

Defaults (desktop ≥ 1280px wide):
- **Tree**: flex-grow 1, min 480px
- **Trace**: 360px, collapsible to 0 (hidden)
- **Chat**: 380px, fixed but resizable down to 320px / up to 560px

Below 1280px we collapse the trace panel by default; below 1024px we stack chat under the tree.

Resizing is handled by `react-resizable-panels` or a custom drag handle. The widths persist to `localStorage` via `uiStore`.

## Top bar

A single row above all panels showing:
- Current tree (dropdown if multiple trees loaded)
- Current run id (clickable → copies to clipboard)
- Current model
- Connection status badge (`idle`, `streaming`, `done`, `error`)
- Settings cog → opens a side sheet with model / params

The top bar reads from `traceStore` and `uiStore`. It has no business logic.

## Region responsibilities, recap

| Region | Reads | Writes |
|---|---|---|
| Tree | `useTree(tree_id)` (server data), `traceStore.cursor_id`, `traceStore.visited_ids` | `uiStore.selectedNode` (click) |
| Trace | `traceStore.steps`, `traceStore.status` | `uiStore.selectedStep` |
| Chat | `chatStore.messages`, `useSendQuery()` | `chatStore`, kicks off a new run |

Cross-region: clicking a step in the Trace highlights its node in the Tree (`uiStore.selectedNode`). Hovering a tree node shows its description in a tooltip.

## Empty / loading / error states

| State | Tree | Trace | Chat |
|---|---|---|---|
| App boot | skeleton tree (3 fake nodes) | "no run yet" | input ready, send disabled |
| Query sent, no events yet | tree faded, cursor unset | "starting..." | message added optimistically |
| First step arrives | cursor highlighted | step card appears | normal |
| Run errors | tree returns to idle | red error card | error appears as a system message |
| Run done | last-cursor highlighted | all step cards | final answer rendered |

All four state machines feed off the same SSE stream — see [04-live-trace.md](./04-live-trace.md).

## Why three panels, not tabs

Tabs hide the second piece of context. The whole pitch of this project is *seeing the agent reason while it reasons*. If the tree is behind a tab, the user has to choose between watching the agent and reading its answer — exactly the wrong tradeoff.

## Color / theme

Dark mode default (consistent with what we'll be staring at for hours). Tailwind's `slate-900` background, `slate-100` text. Accent color for current node, faded color for visited, normal for unvisited. Specific palette in `tailwind.config.js`.

Accessibility: no information conveyed by color alone. The current node is also marked with a ring; visited nodes also get a small dot indicator.

## What is intentionally not on screen (yet)

- A node editor (we edit JSON files for now).
- A run history list (you can fetch by `run_id` via the URL bar; we add a sidebar when it matters).
- Multi-trace comparison view (planned for after the baseline works).
- A settings drawer beyond model + max_depth.

Each of these has a known slot in the layout if/when we add it.
