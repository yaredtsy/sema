import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createTree, deleteTree, listTrees } from "@/api/trees";
import { Spinner } from "@/components/Spinner";
import type { Tree } from "@/types";

function emptyTree(id: string, name: string): Tree {
  return {
    id,
    name,
    description: "",
    root: {
      id,
      title: name,
      description: "Root node",
      detail: "",
      children: [],
      tags: [],
    },
  };
}

export function TreeListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["trees"],
    queryFn: listTrees,
  });

  const create = useMutation({
    mutationFn: createTree,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trees"] }),
  });

  const remove = useMutation({
    mutationFn: deleteTree,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trees"] }),
  });

  if (isLoading) return <Spinner />;
  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Failed to load trees. Is the backend running?</p>
      </div>
    );
  }

  const trees = data?.trees ?? [];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Knowledge trees</h1>
          <p className="mt-1 text-sm text-slate-500">
            Structured maps the agent will traverse. Select one to view and edit.
          </p>
        </div>
        <button
          type="button"
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
          disabled={create.isPending}
          onClick={() => {
            const id = `tree-${Date.now()}`;
            create.mutate(emptyTree(id, "New tree"));
          }}
        >
          New tree
        </button>
      </header>

      {trees.length === 0 ? (
        <p className="text-slate-500">No trees yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {trees.map((tree) => (
            <li
              key={tree.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 hover:border-slate-700"
            >
              <Link to={`/trees/${tree.id}`} className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{tree.name}</p>
                <p className="truncate text-sm text-slate-500">
                  {tree.description || tree.id}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {tree.node_count ?? 0} nodes · {tree.id}
                </p>
              </Link>
              <button
                type="button"
                className="ml-4 rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600"
                onClick={() => navigate(`/playground?tree=${tree.id}`)}
              >
                ▶ Run tree
              </button>
              <button
                type="button"
                className="ml-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-rose-700 hover:text-rose-400"
                onClick={() => {
                  if (confirm(`Delete tree "${tree.name}"?`)) {
                    remove.mutate(tree.id);
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
