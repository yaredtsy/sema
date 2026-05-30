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
import { Legend } from "./Legend";
import { layoutTree } from "../lib/layout";
import { classifyNode } from "../lib/highlights";
import { useUiStore } from "../../../stores/useUiStore";
import { useRunsStore } from "../../../stores/useRunsStore";
import type { Tree } from "@/types";

const nodeTypes = { treeNode: TreeNode };

/**
 * Middle region: the ReactFlow knowledge-tree canvas.
 *
 * Takes the resolved tree as a prop — the page owns the fetch / demo /
 * empty branching, the canvas just renders. Re-styles nodes and edges in
 * response to the active run (visited path, cursor, focused step).
 */
export function TreeCanvas({ tree }: { tree: Tree }) {
  const debugTarget = useUiStore((s) => s.debugTarget);
  const selectedStepIdx = useUiStore((s) => s.selectedStepIdx);
  const setSelectedNodeId = useUiStore((s) => s.setSelectedNodeId);
  const run = useRunsStore((s) => (debugTarget ? s.runs[debugTarget] : null));

  const cursorId = run?.cursor_id ?? null;
  const visitedIds = run?.visited_ids ?? [];

  const stepNodeId = useMemo(() => {
    if (!run || selectedStepIdx === null) return null;
    return run.trace[selectedStepIdx]?.node_id ?? null;
  }, [run, selectedStepIdx]);

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => layoutTree(tree.root),
    [tree.root],
  );

  const styledNodes: FlowNode[] = useMemo(() => {
    const visitedSet = new Set(visitedIds);
    return baseNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        highlight: classifyNode(
          n.id,
          { cursorId, visitedIds, stepNodeId },
          visitedSet,
        ),
      },
    }));
  }, [baseNodes, cursorId, visitedIds, stepNodeId]);

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

  // ReactFlow owns layout mutations (drag, pan). We keep the user's positions
  // and overlay our highlight data on top.
  const [nodes, , onNodesChange] = useNodesState(styledNodes);
  const [edges, , onEdgesChange] = useEdgesState(styledEdges);

  const finalNodes = useMemo(
    () =>
      nodes.map((n) => {
        const sn = styledNodes.find((s) => s.id === n.id);
        return sn ? { ...n, data: sn.data } : n;
      }),
    [nodes, styledNodes],
  );

  const finalEdges = useMemo(
    () =>
      edges.map((e) => {
        const se = styledEdges.find((s) => s.id === e.id);
        return se ? { ...e, style: se.style, animated: se.animated } : e;
      }),
    [edges, styledEdges],
  );

  const onNodeClick = useCallback(
    (_: unknown, node: FlowNode) => setSelectedNodeId(node.id),
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

      {debugTarget && <Legend stepIdx={selectedStepIdx} />}
    </div>
  );
}
