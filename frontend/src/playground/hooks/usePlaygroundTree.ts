import { useQuery } from "@tanstack/react-query";
import { getTree } from "@/api/trees";
import type { Tree } from "@/types";
import { qk } from "../lib/queryKeys";
import { usePlaygroundParams } from "../features/url-state";
import { mockTree } from "../mocks/tree";

/**
 * The current playground tree, resolved from URL params.
 *
 * Demo mode (`?demo=1`) short-circuits the fetch and returns the static
 * fixture so the playground works offline. Otherwise this is a thin
 * React Query wrapper over `GET /trees/:id` keyed via the `qk` factory.
 *
 * Returns `data: undefined` when there is no tree id and no demo flag —
 * callers should already have routed to `EmptyState` in that case.
 */

const DEMO_TREE: Tree = {
  id: mockTree.id,
  name: mockTree.name,
  description: mockTree.description,
  root: mockTree.root,
};

interface UsePlaygroundTreeResult {
  data: Tree | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function usePlaygroundTree(): UsePlaygroundTreeResult {
  const { tree: treeId, demo } = usePlaygroundParams();

  const query = useQuery({
    queryKey: treeId ? qk.tree(treeId) : ["tree", "__unused__"],
    queryFn: () => getTree(treeId!),
    enabled: Boolean(treeId) && !demo,
  });

  if (demo) {
    return {
      data: DEMO_TREE,
      isLoading: false,
      isError: false,
      error: null,
      refetch: () => {},
    };
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      query.refetch();
    },
  };
}
