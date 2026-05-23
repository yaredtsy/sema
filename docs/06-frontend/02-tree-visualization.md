# Tree visualization

The base rendering of the dendrogram. This doc covers layout, node rendering, and interaction — but **not** the agent-run overlay. The overlay (highlighting visited nodes, drawing the route, showing per-node step detail when a debug target is set) is in [05-tree-overlay-debug.md](./05-tree-overlay-debug.md).

## Library

**React Flow** (`reactflow` v11). Reasons:
- Pan/zoom is built in.
- Custom node renderers via React components — we can show title + a small description tooltip.
- Edge animation (CSS animations on a selected edge) gives us "the agent just descended through this edge" for free.
- Maintained, typed.

We considered D3 (layout flexibility, but imperative DOM) and `react-d3-tree` (cute but inflexible). React Flow is the right balance.

## Layout

React Flow does not lay out trees on its own. We feed it positions, computed by [`d3-hierarchy`](https://github.com/d3/d3-hierarchy)'s `tree` layout:

```ts
// frontend/src/features/tree/layout.ts
import { hierarchy, tree } from "d3-hierarchy";

export function layoutTree(root: Node) {
  const h = hierarchy(root, (n) => n.children);
  const t = tree<Node>().nodeSize([180, 80])(h);

  const nodes = t.descendants().map((d) => ({
    id: d.data.id,
    position: { x: d.y, y: d.x },     // swap x/y for horizontal layout
    data: { node: d.data, depth: d.depth },
    type: "treeNode",
  }));
  const edges = t.links().map((l) => ({
    id: `${l.source.data.id}__${l.target.data.id}`,
    source: l.source.data.id,
    target: l.target.data.id,
    type: "smoothstep",
  }));

  return { nodes, edges };
}
```

The layout is **horizontal** (root on the left, leaves on the right). With dotted ids and deepish trees this reads better than top-down.

We recompute layout only when the tree changes — never on agent step. Step events only flip highlight classes; positions stay frozen.

## Node renderer

A single `TreeNode` component renders all nodes. It receives `data: { node, depth }` and reads its highlight state from `traceStore`:

```tsx
function TreeNode({ data, id }: NodeProps) {
  const isCurrent  = useTraceStore((s) => s.cursorId === id);
  const isVisited  = useTraceStore((s) => s.visitedIds.includes(id));
  const isSelected = useUiStore((s) => s.selectedNode === id);

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm transition",
        "bg-slate-800/60 border-slate-700",
        isVisited  && "border-slate-500 bg-slate-700/60",
        isCurrent  && "border-emerald-400 ring-2 ring-emerald-400/40 bg-slate-700",
        isSelected && "ring-2 ring-sky-400/60",
      )}
      onClick={() => useUiStore.getState().setSelectedNode(id)}
      onMouseEnter={() => setTooltip(data.node.description)}
    >
      <div className="font-medium">{data.node.title}</div>
      <div className="text-xs text-slate-400 line-clamp-1">{data.node.description}</div>
    </div>
  );
}
```

## Highlight states

| State | Visual | Source |
|---|---|---|
| Idle | dim slate | default |
| Visited | medium slate, faint border | `traceStore.visitedIds` |
| Current | green ring + emphasis | `traceStore.cursorId` |
| Considered (sibling of last decision) | dashed border | `traceStore.lastChildrenSet` |
| Selected (user click) | sky ring | `uiStore.selectedNode` |

"Considered" is a nice-to-have. On each `step` event we compute the children set of the deciding node and set it briefly (1.5s) before fading.

## Edge animation

When a `visit` event arrives we animate the edge `(prev_cursor) → (new_cursor)` via React Flow's `animated: true` flag for ~700ms, then turn it off. CSS handles the dashed flow effect.

## Node detail panel

Clicking a node opens a small read-only side card (slides in from the tree panel's right edge) showing:

- `title`, `description`
- Breadcrumbs (clickable to navigate the viz)
- Full `detail` rendered as markdown
- Tags

This is the only way to read `detail` in the UI without running a query.

## Performance

Trees we expect (< 500 nodes) render fine without virtualization. If we ever blow past that:

- React Flow has `onlyRenderVisibleElements`.
- Switch from `smoothstep` edges to `straight` (cheaper to render).
- Drop the tooltip listener (it forces re-renders on every hover).

We won't optimize until we hit a real problem.

## Mini-map

React Flow's `<MiniMap />` component, bottom-right. Useful for big trees. Hide it on small viewports.

## Keyboard

- `f` — fit view
- `c` — center on current cursor
- `←`/`→` — when a node is selected, navigate to its parent / first child

The shortcuts live in `useTreeShortcuts()` (in `features/tree/hooks.ts`).
