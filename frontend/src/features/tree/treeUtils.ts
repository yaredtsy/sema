import type { Node } from "@/types";

export function findNode(root: Node, nodeId: string): Node | null {
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function updateNodeInTree(root: Node, nodeId: string, patch: Partial<Node>): Node {
  if (root.id === nodeId) {
    return { ...root, ...patch, children: root.children };
  }
  return {
    ...root,
    children: (root.children ?? []).map((c) => updateNodeInTree(c, nodeId, patch)),
  };
}

export function collectNodeIds(node: Node): string[] {
  const ids = [node.id];
  for (const child of node.children ?? []) {
    ids.push(...collectNodeIds(child));
  }
  return ids;
}
