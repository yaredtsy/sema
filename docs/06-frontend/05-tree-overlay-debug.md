# Tree-overlay debug view

The "map" half of the GPS-history debugger. The tree visualization isn't just for showing the static knowledge structure — when a debug target is set, it becomes a **route projection** of that run.

This doc focuses on the *overlay behavior*. The base tree rendering is in [02-tree-visualization.md](./02-tree-visualization.md). The debug-target machinery is in [04-debug-panel.md](./04-debug-panel.md).

> **Status — experimental.** Basic overlay works: visited nodes get a sky fill, the final cursor gets an amber fill, the selected step gets a violet ring, and visited-to-visited edges turn sky. A legend appears top-left and a help hint appears bottom-center when no target is set. Missing: per-node **step-index badges**, **hover tooltip**, **inspector card** on click, **live mode**, **scrub-aware dimming**, **auto-pan / smooth re-center**, and the **edge animation** on `visit` events. Below describes the intended shape; gaps are flagged.

## The idea

Given `uiStore.debugTarget` = a `run_id`, the tree paints the agent's walk onto itself:

- Visited nodes are highlighted.
- Edges between consecutive visited nodes get drawn as the **route**.
- The current cursor (live) or selected step (replay) gets a strong emphasis.
- Clicking a visited node reveals what the agent saw, thought, and decided at that node.

The tree becomes the map of one specific trip. Switch trips (pick a different message in the debug panel) → the overlay updates.

## Visual layers (z-order, low to high)

Today's layers:

1. **Base tree** — all nodes in slate, with React Flow's smoothstep edges.
2. **Visited overlay** — nodes in `run.visited_ids` get a sky fill + border.
3. **Cursor** — `run.cursor_id` (the final cursor of the run) gets an amber fill + border.
4. **Selected step marker** — violet fill + ring on the node of `run.trace[selectedStepIdx]`.
5. **Route edges** — visited-to-visited edges get a sky stroke (static, not animated).
6. **Legend chips** — top-left of the tree pane: `visited` / `final cursor` / `step N` (when a step is selected).

Planned layers (not built):

7. **Step-index badge** in each visited node's corner.
8. **Edge animation** — CSS dashed-flow on the freshly traversed edge during live runs (~700 ms).
9. **Considered siblings** — dashed border, fades in 1.5 s.
10. **Concurrent live runs** — thin violet underline on their currently visiting node.
11. **Error** — rose border on the failing step's node.

## Visited node — rendering

**Today** a visited node gets a sky fill + border and that's it.

**Planned** additions to make the visit ordering legible at a glance:

- A small **step index badge** in the corner (`0`, `1`, `2`, ...). Tells you in what order the agent visited it.
- A subtle **decision arrow** drawn to the next visited child (with a CSS keyframe animation when the step was just visited live).
- A tooltip on hover showing: `step N · decision: descend "Python" · 410ms`.

Unvisited nodes stay in their base style. ✅ already so today.

## Selected step — when the user scrubs

**Today:** when `uiStore.selectedStepIdx = i`, that step's node gets a violet ring and the legend chip flips to `step N`. No panning, no zooming, and the rest of the route is **not** dimmed (later visited nodes still show sky).

**Planned:**
- The tree centers on `cursorIdAt(i)` (smooth pan/zoom) — gated by an `autoPan` toggle so power users can pan freely without the view snapping back.
- The route up to step `i` is shown; later visited nodes (in the saved trace, but not yet "reached" at this scrub point) are dimmed.

This makes the replay feel like a real navigation rewind.

## Clicking a visited node — the inspector card

> **Status: not built.** Today, clicking a node — visited or not — only writes `uiStore.selectedNodeId` and renders nothing. The inspector card below is the intended behavior.

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

> **Status: not built** (same gap as visited-node click).

Shows the static node detail (title, description, full markdown `detail`, breadcrumbs, tags). No agent data — the agent never visited this node on the selected run.

If a *different* past run visited this node, a subtle hint shows: *"Visited in msg #2 — view that trip?"* with a button to switch the debug target.

## Live mode

> **Status: planned — no streaming exists yet.**

When the debug target is a streaming run:
- Each `visit` event animates an edge from the previous cursor to the new one.
- Each `step` event upserts the visited-node visuals + the step-index badge.
- A subtle pulse on the current cursor.
- The tree auto-pans to keep the current cursor in view (configurable; off if the user has manually panned).

## Replay mode

> **Status: partially built.** Mock runs already render the full overlay; you can pick a step in the debug panel and that node lights violet. The **scrubber** itself and **progressive dimming** are not built.

When the debug target is a completed run:
- All visited nodes are already lit.
- The scrubber in the debug panel drives `uiStore.selectedStepIdx`.
- Scrubbing reveals the route progressively (steps after `selectedStepIdx` are dimmed).

## Switching the target

**Today:** the overlay swaps instantly (no fade, no pan, no zoom). The visited set is recomputed in a `useMemo` keyed on the active `run`. Edge styles change in place. Node positions never change.

**Planned:**

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

Shipped today:

| Element | Style |
|---|---|
| Unvisited node | `slate-900` fill, `slate-700` border |
| Visited node (in target run) | `sky-950/60` fill, `sky-500` border, `sky-200` text |
| Final cursor of the run | `amber-950/60` fill, `amber-400` border, `amber-200` text + soft amber shadow |
| Selected step | `violet-950/60` fill, `violet-400` border, `ring-2 ring-violet-400/40` |
| Route edge (visited→visited) | `#38bdf8` (sky-400) stroke, width 2, static (not animated) |
| Idle edge | React Flow default smoothstep |

Planned:

| Element | Style |
|---|---|
| Step-index badge on a visited node | small pill, top-left corner, `slate-800/80` bg, `slate-200` text |
| Current cursor (live) | emerald ring + pulse |
| Route edge — freshly traversed | animated dashed flow (CSS keyframe), ~700 ms |
| Concurrent-live cursor (other run) | violet underline only |
| Error step's node | rose border |

Accessibility: today, color is the primary signal. The non-color companions (step badge, dashed border for "considered", ring weight for cursor pulse) are part of the planned set above.

## Keyboard

> **Status: planned, not built.**

| Key | Action |
|---|---|
| `f` | Fit view to the entire tree |
| `c` | Center on current cursor (live) or selected step (replay) |
| `←` / `→` | Step backward / forward in the route (drives `selectedStepIdx`) |
| `Esc` | Close the inspector card / clear debug target |

## Why this view, not "just" a step list

The step list is necessary but it strips the **topology**. The tree-overlay shows:

- **Which subtree** the agent explored. Was the walk concentrated in one branch, or did it ping-pong?
- **How deep** it went vs. how broad the tree is. Did it bottom out?
- **Visual proximity** of decisions. Two consecutive descents in a tight cluster mean "the agent honed in"; a long edge means "the agent jumped categories".

Spatial intuition about reasoning is the unique value of this view. The chat-style view gives narrative; the tree-overlay gives shape. Both, side by side, are the whole point.

## Future improvements

1. **Step-index badge** on visited nodes — the missing non-color companion to the sky highlight.
2. **Inspector card** on node click — wire `uiStore.selectedNodeId` into a slide-in card showing per-node step detail (visited) or static node detail (unvisited).
3. **Hover tooltip** — `description` always; when in a debug run, append `step N · → child · 410ms`.
4. **Auto-pan / smooth re-center** on `selectedStepIdx` change, gated by an `autoPan` toggle so manual panning isn't fought.
5. **Progressive dimming during scrub** — once the scrubber lands, dim visited nodes after `selectedStepIdx`.
6. **Edge animation** — CSS dashed-flow on the freshly traversed edge when a `visit` event arrives live.
7. **Considered siblings** — dashed border on the deciding node's other children for ~1.5 s after each `step`.
8. **Cross-run "visited in msg #N" hint** when an unvisited node was used by another run.
9. **Smooth target-switch transition** — fade out / fade in over 200 ms; fit to the new visited subtree.
