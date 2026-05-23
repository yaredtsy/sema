import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { cn } from "@/lib/cn";
import type { Node } from "@/types";

export interface TreeNodeData {
  label: string;
  description: string;
  nodeData: Node;
  highlight?: "visited" | "cursor" | "step";
}

export function TreeNode({ data, selected }: NodeProps) {
  const { label, description, highlight } = data as TreeNodeData;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs transition-all duration-200 shadow-sm",
        highlight === "cursor" &&
          "border-amber-400 bg-amber-950/60 text-amber-200 shadow-amber-900/40 shadow-md",
        highlight === "visited" &&
          "border-sky-500 bg-sky-950/60 text-sky-200",
        highlight === "step" &&
          "border-violet-400 bg-violet-950/60 text-violet-200 ring-2 ring-violet-400/40",
        !highlight && "border-slate-700 bg-slate-900 text-slate-300",
        selected && !highlight && "border-slate-400",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !border-0 !w-2 !h-2" />
      <div className="font-semibold leading-tight truncate">{label}</div>
      <div className="mt-0.5 text-[10px] opacity-60 truncate leading-tight">{description}</div>
      <Handle type="source" position={Position.Right} className="!bg-slate-600 !border-0 !w-2 !h-2" />
    </div>
  );
}
