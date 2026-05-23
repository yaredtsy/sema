import { apiFetch } from "@/api/client";

export interface QueryResponse {
  run_id: string;
}

export function postQuery(body: { tree_id: string; query: string }): Promise<QueryResponse> {
  return apiFetch<QueryResponse>("/query", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
