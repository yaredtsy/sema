import { useQuery } from "@tanstack/react-query";
import { getTree } from "@/api/trees";

export function useTree(treeId: string | null) {
  return useQuery({
    queryKey: ["tree", treeId],
    queryFn: () => getTree(treeId!),
    enabled: Boolean(treeId),
  });
}
