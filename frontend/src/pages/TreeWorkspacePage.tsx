import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateTree } from "@/api/trees";
import { Panel } from "@/components/Panel";
import { Spinner } from "@/components/Spinner";
import { AgentPlaceholder } from "@/features/chat/AgentPlaceholder";
import { NodeEditor } from "@/features/tree/NodeEditor";
import { TreeOutline } from "@/features/tree/TreeOutline";
import { findNode, updateNodeInTree } from "@/features/tree/treeUtils";
import { useTree } from "@/features/tree/hooks";
import type { Tree } from "@/types";

export function TreeWorkspacePage() {
  const { treeId } = useParams<{ treeId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: serverTree, isLoading, error } = useTree(treeId ?? null);

  const [draft, setDraft] = useState<Tree | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (serverTree) {
      setDraft(structuredClone(serverTree));
      setSelectedNodeId(serverTree.root.id);
      setDirty(false);
    }
  }, [serverTree]);

  const save = useMutation({
    mutationFn: (tree: Tree) => updateTree(tree.id, tree),
    onSuccess: (saved) => {
      queryClient.setQueryData(["tree", saved.id], saved);
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      setDraft(structuredClone(saved));
      setDirty(false);
    },
  });

  if (isLoading || !treeId) return <Spinner />;
  if (error || !draft) {
    return (
      <div className="p-8">
        <p className="text-red-400">Tree not found.</p>
        <Link to="/" className="mt-2 inline-block text-sm text-sky-400">
          Back to list
        </Link>
      </div>
    );
  }

  const selectedNode = selectedNodeId ? findNode(draft.root, selectedNodeId) : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-300">
            ← Trees
          </Link>
          <div>
            <input
              className="bg-transparent text-lg font-semibold text-slate-100 outline-none"
              value={draft.name}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                setDirty(true);
              }}
            />
            <input
              className="block w-full bg-transparent text-xs text-slate-500 outline-none"
              placeholder="Description"
              value={draft.description ?? ""}
              onChange={(e) => {
                setDraft({ ...draft, description: e.target.value });
                setDirty(true);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-40"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(draft)}
          >
            {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
          <button
            type="button"
            className="rounded bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={dirty}
            title={dirty ? "Save first to run" : "Open this tree in the playground"}
            onClick={() => navigate(`/playground?tree=${treeId}`)}
          >
            ▶ Run tree
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Panel title="Structure" className="w-72 shrink-0 min-w-0">
          <TreeOutline
            root={draft.root}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
          />
        </Panel>
        <Panel title="Edit node" className="flex-1 min-w-0 border-x border-slate-800">
          {selectedNode ? (
            <NodeEditor
              node={selectedNode}
              onChange={(patch) => {
                setDraft({
                  ...draft,
                  root: updateNodeInTree(draft.root, selectedNode.id, patch),
                });
                setDirty(true);
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">Select a node from the outline.</p>
          )}
        </Panel>
        <Panel title="Chat" className="w-96 shrink-0 min-w-0">
          <AgentPlaceholder />
        </Panel>
      </div>
    </div>
  );
}
