import type { Node } from "@/types";

interface NodeEditorProps {
  node: Node;
  onChange: (patch: Partial<Node>) => void;
}

export function NodeEditor({ node, onChange }: NodeEditorProps) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Node id</label>
        <p className="font-mono text-slate-400">{node.id}</p>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500" htmlFor="node-title">
          Title
        </label>
        <input
          id="node-title"
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          value={node.title}
          maxLength={80}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500" htmlFor="node-desc">
          Description
        </label>
        <textarea
          id="node-desc"
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          rows={3}
          maxLength={280}
          value={node.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500" htmlFor="node-detail">
          Detail (markdown)
        </label>
        <textarea
          id="node-detail"
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
          rows={8}
          value={node.detail ?? ""}
          onChange={(e) => onChange({ detail: e.target.value })}
        />
      </div>
    </div>
  );
}
