import { useState } from "react";
import { cn } from "@/lib/cn";
import { useRunsStore } from "../../../stores/useRunsStore";
import { useUiStore } from "../../../stores/useUiStore";

/**
 * Inline expandable summary of the routing path for an assistant message.
 *
 * Doubles as the entry point into the trace panel: the "Debug this" button
 * sets the global debug target to this message's run.
 */
export function RouteSummary({ runId }: { runId: string }) {
  const run = useRunsStore((s) => s.runs[runId]);
  const debugTarget = useUiStore((s) => s.debugTarget);
  const setDebugTarget = useUiStore((s) => s.setDebugTarget);
  const [open, setOpen] = useState(false);

  if (!run) return null;

  const isDebugging = debugTarget === runId;

  return (
    <div className="mt-2 space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded bg-slate-800/60 border border-slate-700/60 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-600 transition-colors"
      >
        <span className="text-sky-500">⬡</span>
        <span className="font-mono">{run.visited_ids.join(" → ")}</span>
        <span className="text-slate-600">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="rounded border border-slate-700/60 bg-slate-900/60 divide-y divide-slate-800">
          {run.trace.map((step) => (
            <div key={step.step_idx} className="flex items-start gap-2 px-2 py-1.5">
              <span className="text-[9px] font-mono text-slate-600 mt-0.5">
                #{step.step_idx}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-medium text-slate-300">{step.node_id}</span>
                <span className="ml-2 text-[9px] text-sky-400">
                  → {step.decision.child_id ?? step.decision.kind}
                </span>
                <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1">
                  "{step.thinking.text}"
                </p>
              </div>
              <span className="text-[9px] text-slate-600 font-mono">{step.latency_ms}ms</span>
            </div>
          ))}
          <div className="px-2 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-emerald-400">✓ {run.cursor_id}</span>
            <button
              type="button"
              onClick={() => setDebugTarget(isDebugging ? null : runId)}
              className={cn(
                "text-[10px] rounded px-2 py-0.5 border transition-colors",
                isDebugging
                  ? "border-violet-500 bg-violet-950/40 text-violet-300"
                  : "border-slate-600 text-slate-400 hover:border-violet-500 hover:text-violet-300",
              )}
            >
              {isDebugging ? "Debugging ✓" : "Debug this"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
