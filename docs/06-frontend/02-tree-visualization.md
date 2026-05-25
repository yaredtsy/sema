# Tree visualization

The base rendering of the dendrogram. This doc covers layout, node rendering, and interaction — but **not** the agent-run overlay. The overlay (highlighting visited nodes, drawing the route, showing per-node step detail when a debug target is set) is in [05-tree-overlay-debug.md](./05-tree-overlay-debug.md).

> **Status — experimental.** Base rendering works: dendrogram with visited / cursor / selected-step highlights, a MiniMap, controls, and a legend that appears when a debug target is set. Node click currently only writes `uiStore.selectedNodeId` (no inspector card yet). Hover tooltips, step-index badges, edge animations on `visit`, and the "considered" sibling highlight are **planned**.

## Library

**React Flow** (`@xyflow/react` v12 — package was renamed from `reactflow` v11). Reasons:
- Pan/zoom is built in.
- Custom node renderers via React components — we can show title + a small description tooltip.
- Edge animation (CSS animations on a selected edge) gives us "the agent just descended through this edge" for free.
- Maintained, typed.

We considered D3 (layout flexibility, but imperative DOM) and `react-d3-tree` (cute but inflexible). React Flow is the right balance.

## Layout

React Flow does not lay out trees on its own. We feed it positions, computed by [`d3-hierarchy`](https://github.com/d3/d3-hierarchy)'s `tree` layout.

The shipping version (`frontend/src/features/tree/layout.ts`) — slightly differs from the snippet below in node sizing and edge id format:

```ts
// frontend/src/features/tree/layout.ts (current)
const NODE_W = 180;
const NODE_H = 64;
const H_SEP = 220;
const V_SEP = 100;

export function layoutTree(root: Node): { nodes: FlowNode[]; edges: Edge[] } {
  const hier = hierarchy(root, (n) => n.children ?? []);
  const layout = tree<Node>().nodeSize([NODE_H + V_SEP, NODE_W + H_SEP]);
  layout(hier);

  const flowNodes = hier.descendants().map((d) => ({
    id: d.data.id,
    type: "treeNode",
    position: { x: d.y ?? 0, y: d.x ?? 0 }, // swap x/y for horizontal layout
    data: { label: d.data.title, description: d.data.description, nodeData: d.data },
    style: { width: NODE_W },
  }));

  const flowEdges = hier.links().map((link) => ({
    id: `${link.source.data.id}→${link.target.data.id}`,
    source: link.source.data.id,
    target: link.target.data.id,
    type: "smoothstep",
  }));

  return { nodes: flowNodes, edges: flowEdges };
}
```

The layout is **horizontal** (root on the left, leaves on the right). With dotted ids and deepish trees this reads better than top-down.

We recompute layout only when the tree changes — never on agent step. Step events only flip highlight classes; positions stay frozen.

## Node renderer

A single `TreeNode` component renders all nodes. **Today** the highlight decision is computed in `TreePanel.tsx` (which reads `traceStore` and `uiStore`) and passed down as `data.highlight`; the node component itself is presentational:

```tsx
// features/tree/TreeNode.tsx (current)
export function TreeNode({ data, selected }: NodeProps) {
  const { label, description, highlight } = data as TreeNodeData;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs transition-all duration-200 shadow-sm",
        highlight === "cursor"  && "border-amber-400 bg-amber-950/60 text-amber-200 …",
        highlight === "visited" && "border-sky-500 bg-sky-950/60 text-sky-200",
        highlight === "step"    && "border-violet-400 bg-violet-950/60 ring-2 …",
        !highlight && "border-slate-700 bg-slate-900 text-slate-300",
        selected && !highlight && "border-slate-400",
      )}
    >
      <Handle type="target" position={Position.Left}  className="!bg-slate-600 …" />
      <div className="font-semibold leading-tight truncate">{label}</div>
      <div className="mt-0.5 text-[10px] opacity-60 truncate leading-tight">{description}</div>
      <Handle type="source" position={Position.Right} className="!bg-slate-600 …" />
    </div>
  );
}
```

> No tooltip, no step-index badge, no click handler on the node itself — the click handler lives on the React Flow surface (`onNodeClick` in `TreePanel.tsx`). The pattern from the snippet above (read directly from `traceStore`) was tried and reverted to a single derive-in-parent approach to avoid redundant re-renders. Pick whichever you prefer when the node grows more state.

## Highlight states

Implemented today:

| State | Visual | Source |
|---|---|---|
| Idle | dim slate (`slate-900` fill, `slate-700` border) | default |
| Visited | sky fill + border | `run.visited_ids` |
| Cursor (final cursor of the run) | amber fill + border | `run.cursor_id` |
| Selected step | violet fill + ring | `uiStore.selectedStepIdx` → `run.trace[idx].node_id` |
| Selected (user click, no debug) | slate-400 border | `uiStore.selectedNodeId` |

Planned but not built:

| State | Visual | Source |
|---|---|---|
| **Current** (live cursor, distinct from final cursor) | emerald ring + pulse | live `traceStore` cursor of an in-flight run |
| **Considered** (sibling of last decision) | dashed border, fades in 1.5 s | computed on each `step` event |
| **Concurrent live cursor** (other run streaming while this one is the target) | thin violet underline | secondary run's cursor |
| **Error** | rose border | step with error |
| **Step-index badge** | `0/1/2…` corner badge | `run.visited_ids.indexOf(id)` |

## Edge animation

> **Status: planned.** Today, edges that connect two visited nodes get a static sky stroke (no animation). When live streaming lands we want each `visit` event to animate the edge `(prev_cursor) → (new_cursor)` via React Flow's `animated: true` flag for ~700 ms, then turn it off. CSS handles the dashed flow effect.

## Node detail panel

> **Status: planned for the playground.** Today, clicking a node on the playground tree sets `uiStore.selectedNodeId` and renders nothing else. (The tree-editor at `/trees/:treeId` has a full `NodeEditor`; the playground intentionally doesn't reuse it because it's read-only context.) The intended behavior:

Clicking a node opens a small read-only side card (slides in from the tree panel's right edge) showing:

- `title`, `description`
- Breadcrumbs (clickable to navigate the viz)
- Full `detail` rendered as markdown
- Tags

This would be the only way to read `detail` in the playground without running a query.

## Performance

Trees we expect (< 500 nodes) render fine without virtualization. If we ever blow past that:

- React Flow has `onlyRenderVisibleElements`.
- Switch from `smoothstep` edges to `straight` (cheaper to render).
- Drop the tooltip listener (it forces re-renders on every hover).

We won't optimize until we hit a real problem.

## Mini-map

React Flow's `<MiniMap />` component, bottom-right — shipped. Node color follows the highlight (cursor amber, step violet, visited sky, idle slate). Hide it on small viewports — not yet wired.

## Keyboard

> **Status: not built.** No keyboard shortcuts on the tree today. Planned set:

- `f` — fit view
- `c` — center on current cursor (live) or selected step (replay)
- `←`/`→` — when a node is selected, navigate to its parent / first child

The shortcuts would live in `useTreeShortcuts()` (in `features/tree/hooks.ts`).

## Future improvements

1. **Step-index badges** on visited nodes — top-left corner pill showing the order in which the agent visited the node.
2. **Hover tooltip** — title attribute is fine for v1, then upgrade to a real popover that shows `description`, and (when a debug run is active) `decision · child · latency`.
3. **Inspector card** on node click — the "node detail panel" above.
4. **Edge animation** on `visit` events once a real stream exists.
5. **Considered siblings** dashed-border highlight on the most recent decision.
6. **Keyboard shortcuts** — `f`, `c`, arrow nav.
7. **Auto-pan / zoom to selected step** — gated by the `autoPan` toggle proposed in [01-layout.md](./01-layout.md).
