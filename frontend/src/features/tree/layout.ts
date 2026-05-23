import { hierarchy, tree } from "d3-hierarchy";
import type { Node as FlowNode, Edge } from "@xyflow/react";
import type { Node } from "@/types";

const NODE_W = 180;
const NODE_H = 64;
const H_SEP = 220;
const V_SEP = 100;

export function layoutTree(root: Node): { nodes: FlowNode[]; edges: Edge[] } {
  const hier = hierarchy(root, (n) => n.children ?? []);
  const layout = tree<Node>().nodeSize([NODE_H + V_SEP, NODE_W + H_SEP]);
  layout(hier);

  const flowNodes: FlowNode[] = hier.descendants().map((d) => ({
    id: d.data.id,
    type: "treeNode",
    position: { x: d.y, y: d.x },
    data: { label: d.data.title, description: d.data.description, nodeData: d.data },
    style: { width: NODE_W },
  }));

  const flowEdges: Edge[] = hier.links().map((link) => ({
    id: `${link.source.data.id}→${link.target.data.id}`,
    source: link.source.data.id,
    target: link.target.data.id,
    type: "smoothstep",
  }));

  return { nodes: flowNodes, edges: flowEdges };
}
