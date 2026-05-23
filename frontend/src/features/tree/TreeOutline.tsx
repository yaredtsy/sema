import type { Node } from "@/types";
import { cn } from "@/lib/cn";

interface TreeOutlineProps {
  root: Node;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}

function OutlineNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const isSelected = node.id === selectedId;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-800",
          isSelected && "bg-slate-800 ring-1 ring-sky-600",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="font-medium text-slate-200">{node.title}</span>
        <span className="ml-2 text-xs text-slate-500">{node.id}</span>
      </button>
      {(node.children ?? []).length > 0 && (
        <ul className="mt-0.5 space-y-0.5">
          {(node.children ?? []).map((child) => (
            <OutlineNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TreeOutline({ root, selectedId, onSelect }: TreeOutlineProps) {
  return (
    <ul className="space-y-0.5 overflow-auto">
      <OutlineNode node={root} depth={0} selectedId={selectedId} onSelect={onSelect} />
    </ul>
  );
}
