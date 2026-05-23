// Auto-generated from Pydantic — run `make types` to refresh.
// Do not edit by hand.

export interface Node {
  id: string;
  title: string;
  description: string;
  detail?: string;
  children?: Node[];
  tags?: string[];
}

export interface Tree {
  id: string;
  name: string;
  description?: string;
  root: Node;
}

export interface TreeSummary {
  id: string;
  name: string;
  description?: string;
  node_count?: number;
}

export interface TreeListResponse {
  trees: TreeSummary[];
}
