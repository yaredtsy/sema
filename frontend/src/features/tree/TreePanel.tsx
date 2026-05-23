import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TreeNode } from "./TreeNode";
import { layoutTree } from "./layout";
import { useUiStore } from "@/store/uiStore";
import { useTraceStore } from "@/store/traceStore";
import { mockTree } from "@/data/mockData";

const nodeTypes = { treeNode: TreeNode };

export function TreePanel() {
  const debugTarget = useUiStore((s) => s.debugTarget);
  const selectedStepIdx = useUiStore((s) => s.selectedStepIdx);
  const setSelectedNodeId = useUiStore((s) => s.setSelectedNodeId);
  const run = useTraceStore((s) => (debugTarget ? s.runs[debugTarget] : null));

  const highlightedVisited = useMemo(() => new Set(run?.visited_ids ?? []), [run]);
  const cursorId = run?.cursor_id ?? null;

  const stepNodeId = useMemo(() => {
    if (run && selectedStepIdx !== null) {
      return run.trace[selectedStepIdx]?.node_id ?? null;
    }
    return null;
  }, [run, selectedStepIdx]);

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => layoutTree(mockTree.root),
    [],
  );

  const styledNodes: FlowNode[] = useMemo(
    () =>
      baseNodes.map((n) => {
        let highlight: "cursor" | "visited" | "step" | undefined;
        if (stepNodeId && n.id === stepNodeId) highlight = "step";
        else if (n.id === cursorId) highlight = "cursor";
        else if (highlightedVisited.has(n.id)) highlight = "visited";
        return { ...n, data: { ...n.data, highlight } };
      }),
    [baseNodes, highlightedVisited, cursorId, stepNodeId],
  );

  const styledEdges = useMemo(() => {
    if (!run) return baseEdges;
    const visitedSet = new Set(run.visited_ids);
    return baseEdges.map((e) => {
      const onPath = visitedSet.has(e.source) && visitedSet.has(e.target);
      return onPath
        ? { ...e, style: { stroke: "#38bdf8", strokeWidth: 2 }, animated: false }
        : e;
    });
  }, [baseEdges, run]);

  const [nodes, , onNodesChange] = useNodesState(styledNodes);
  const [edges, , onEdgesChange] = useEdgesState(styledEdges);

  const finalNodes = useMemo(
    () => nodes.map((n) => {
      const sn = styledNodes.find((s) => s.id === n.id);
      return sn ? { ...n, data: sn.data } : n;
    }),
    [nodes, styledNodes],
  );

  const finalEdges = useMemo(
    () => edges.map((e) => {
      const se = styledEdges.find((s) => s.id === e.id);
      return se ? { ...e, style: se.style, animated: se.animated } : e;
    }),
    [edges, styledEdges],
  );

  const onNodeClick = useCallback(
    (_: unknown, node: FlowNode) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={finalNodes}
        edges={finalEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        colorMode="dark"
      >
        <Background color="#334155" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as { highlight?: string };
            if (d.highlight === "cursor") return "#fbbf24";
            if (d.highlight === "step") return "#a78bfa";
            if (d.highlight === "visited") return "#38bdf8";
            return "#334155";
          }}
          style={{ background: "#0f172a" }}
        />
      </ReactFlow>

      {!debugTarget && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-800/90 border border-slate-700 px-3 py-1 text-xs text-slate-400">
          Select a message to debug → route lights up
        </div>
      )}

      {debugTarget && (
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          <span className="rounded px-2 py-0.5 text-[10px] bg-sky-950/80 border border-sky-700 text-sky-300">
            visited
          </span>
          <span className="rounded px-2 py-0.5 text-[10px] bg-amber-950/80 border border-amber-600 text-amber-300">
            final cursor
          </span>
          {selectedStepIdx !== null && (
            <span className="rounded px-2 py-0.5 text-[10px] bg-violet-950/80 border border-violet-600 text-violet-300">
              step {selectedStepIdx}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
