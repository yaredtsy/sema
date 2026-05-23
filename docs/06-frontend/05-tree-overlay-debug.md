# Tree-overlay debug view

The "map" half of the GPS-history debugger. The tree visualization isn't just for showing the static knowledge structure — when a debug target is set, it becomes a **route projection** of that run.

This doc focuses on the *overlay behavior*. The base tree rendering is in [02-tree-visualization.md](./02-tree-visualization.md). The debug-target machinery is in [04-debug-panel.md](./04-debug-panel.md).

## The idea

Given `uiStore.debugTarget` = a `run_id`, the tree paints the agent's walk onto itself:

- Visited nodes are highlighted.
- Edges between consecutive visited nodes get drawn as the **route**.
- The current cursor (live) or selected step (replay) gets a strong emphasis.
- Clicking a visited node reveals what the agent saw, thought, and decided at that node.

The tree becomes the map of one specific trip. Switch trips (pick a different message in the debug panel) → the overlay updates.

## Visual layers (z-order, low to high)

1. **Base tree** — all nodes, faded.
2. **Visited overlay** — nodes touched by the selected run, brighter.
3. **Route edges** — animated polyline through visited nodes, in descent order.
4. **Selected step marker** — emerald ring on `cursorIdAt(selectedStep)`.
5. **Hover / click affordances** — sky ring on `uiStore.selectedNode`.
6. **Concurrent live runs** (if any other run is streaming) — thin violet underline on their *currently visiting* node. Doesn't interfere with the main overlay.

## Visited node — rendering

A visited node gets:

- Bright fill.
- A small **step index badge** in the corner (`0`, `1`, `2`, ...). Tells you in what order the agent visited it.
- A subtle **decision arrow** drawn to the next visited child (with a CSS keyframe animation when the step was just visited live).
- A tooltip on hover showing: `step N · decision: descend "Python" · 410ms`.

Unvisited nodes stay in their base style.

## Selected step — when the user scrubs

When `uiStore.selectedStep = i`:
- The tree centers on `cursorIdAt(i)` (smooth pan/zoom).
- That node gets the strong emerald ring.
- The route up to step `i` is shown; later visited nodes (in the saved trace, but not yet "reached" at this scrub point) are dimmed.

This makes the replay feel like a real navigation rewind.

## Clicking a visited node — the inspector card

Clicking a visited node opens a side card (slides from the tree panel's edge). It shows everything the agent did *at that node*:

```
┌──────────────────────────────────────────────┐
│  cs.languages.python                         │
│  Python — Dynamic, interpreted, batteries…   │
│  step 2 of 4                                 │
├──────────────────────────────────────────────┤
│  Messages in (compact chat bubbles):         │
│    [system] You are a routing agent…         │
│    [user]   <context>…</context>             │
│                                              │
│  Thinking:                                   │
│    "Query asks about asyncio specifically;   │
│     the async child matches."                │
│                                              │
│  Decision:                                   │
│    descend → cs.languages.python.async       │
│    confidence: 0.92                          │
│                                              │
│  Metrics:                                    │
│    latency 410 ms · 932 in / 64 out          │
│                                              │
│  [Show raw output]  [Show full prompt]       │
│  [Jump to step in debug panel]               │
└──────────────────────────────────────────────┘
```

This is the same data the debug panel shows for that step — just projected at the location on the map where it happened. Either entry point works; the data is the same.

## Clicking an unvisited node

Shows the static node detail (title, description, full markdown `detail`, breadcrumbs, tags). No agent data — the agent never visited this node on the selected run.

If a *different* past run visited this node, a subtle hint shows: *"Visited in msg #2 — view that trip?"* with a button to switch the debug target.

## Live mode

When the debug target is a streaming run:
- Each `visit` event animates an edge from the previous cursor to the new one.
- Each `step` event upserts the visited-node visuals + the step-index badge.
- A subtle pulse on the current cursor.
- The tree auto-pans to keep the current cursor in view (configurable; off if the user has manually panned).

## Replay mode

When the debug target is a completed run:
- All visited nodes are already lit.
- The scrubber in the debug panel drives `uiStore.selectedStep`.
- Scrubbing reveals the route progressively (steps after `selectedStep` are dimmed).

## Switching the target

Selecting a different message in the debug panel:
1. Fades out the old overlay (≤ 200 ms).
2. Computes the new visited set from `traceStore.runs[new_run_id]`.
3. Fades in the new overlay.
4. Pans/zooms to fit the new visited subtree.

No re-layout — node positions are fixed for a given tree (see [02-tree-visualization.md](./02-tree-visualization.md)). Only highlight classes and overlay edges change.

## Performance

For trees with ≤ 500 nodes and ≤ 20 steps per run, this is a non-event — pure CSS class changes on a small number of nodes. Edges are drawn as React Flow custom edge components; we recompute them only when the visited set or `selectedStep` change.

If the tree grows huge (5k nodes), we will:
- Cull non-visited subtrees to a "..." placeholder unless explicitly expanded.
- Move the inspector card to a fixed slot to avoid layout thrash.

Not in v1.

## Color and motion legend

| Element | Style |
|---|---|
| Unvisited node | Faded slate fill, thin border |
| Visited node (in target run) | Brighter slate fill, full border, step badge |
| Current cursor (live) | Emerald ring + pulse |
| Selected step (replay) | Emerald ring (no pulse) |
| Route edge | Slate-300 stroke, animated dashed flow when freshly traversed |
| Concurrent-live cursor (other run) | Violet underline only |
| Error step's node | Rose border |

All colors have a non-color companion (ring, badge, border weight) for accessibility.

## Keyboard

| Key | Action |
|---|---|
| `f` | Fit view to the entire tree |
| `c` | Center on current cursor (live) or selected step (replay) |
| `←` / `→` | Step backward / forward in the route (drives `selectedStep`) |
| `Esc` | Close the inspector card |

## Why this view, not "just" a step list

The step list is necessary but it strips the **topology**. The tree-overlay shows:

- **Which subtree** the agent explored. Was the walk concentrated in one branch, or did it ping-pong?
- **How deep** it went vs. how broad the tree is. Did it bottom out?
- **Visual proximity** of decisions. Two consecutive descents in a tight cluster mean "the agent honed in"; a long edge means "the agent jumped categories".

Spatial intuition about reasoning is the unique value of this view. The chat-style view gives narrative; the tree-overlay gives shape. Both, side by side, are the whole point.
