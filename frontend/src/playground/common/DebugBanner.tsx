import { useUiStore } from "../stores/useUiStore";
import { useRunsStore } from "../stores/useRunsStore";

/**
 * Top strip shown when a debug target is active. Clicking "clear" detaches
 * the trace panel from any specific message.
 */
export function DebugBanner() {
  const debugTarget = useUiStore((s) => s.debugTarget);
  const setDebugTarget = useUiStore((s) => s.setDebugTarget);
  const activeRun = useRunsStore((s) => (debugTarget ? s.runs[debugTarget] : null));

  if (!activeRun) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-violet-800/50 bg-violet-950/30 shrink-0">
      <span className="text-[10px] text-violet-400 font-medium">Debugging</span>
      <span className="text-[10px] text-violet-300 font-mono truncate flex-1">
        "{activeRun.query}"
      </span>
      <span className="text-[10px] text-violet-500 font-mono">{activeRun.model}</span>
      <span className="text-[10px] text-violet-600">·</span>
      <span className="text-[10px] text-violet-500">{activeRun.trace.length} steps</span>
      <button
        type="button"
        onClick={() => setDebugTarget(null)}
        className="text-[10px] text-violet-600 hover:text-violet-300 ml-1 shrink-0"
      >
        clear ✕
      </button>
    </div>
  );
}
