import { apiFetch } from "@/api/client";
import type { Node, Tree, TreeSummary } from "@/types";

export interface TreeListResponse {
  trees: TreeSummary[];
}

export interface NodeDetailResponse {
  node: Node;
  breadcrumbs: Node[];
}

export function listTrees(): Promise<TreeListResponse> {
  return apiFetch<TreeListResponse>("/trees");
}

export function getTree(treeId: string): Promise<Tree> {
  return apiFetch<Tree>(`/trees/${treeId}`);
}

export function createTree(tree: Tree): Promise<Tree> {
  return apiFetch<Tree>("/trees", {
    method: "POST",
    body: JSON.stringify(tree),
  });
}

export function updateTree(treeId: string, tree: Tree): Promise<Tree> {
  return apiFetch<Tree>(`/trees/${treeId}`, {
    method: "PUT",
    body: JSON.stringify(tree),
  });
}

export function deleteTree(treeId: string): Promise<void> {
  return apiFetch<void>(`/trees/${treeId}`, { method: "DELETE" });
}

export function getNode(treeId: string, nodeId: string): Promise<NodeDetailResponse> {
  return apiFetch<NodeDetailResponse>(`/trees/${treeId}/nodes/${nodeId}`);
}
