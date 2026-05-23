import { TreePanel } from "@/features/tree/TreePanel";
import { TracePanel } from "@/features/trace/TracePanel";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { useUiStore } from "@/store/uiStore";
import { useTraceStore } from "@/store/traceStore";

function Header() {
  const debugTarget = useUiStore((s) => s.debugTarget);
  const runs = useTraceStore((s) => s.runs);
  const setDebugTarget = useUiStore((s) => s.setDebugTarget);
  const activeRun = debugTarget ? runs[debugTarget] : null;

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tracking-tight text-slate-100">
          sace
        </span>
        <span className="text-slate-700">·</span>
        <span className="text-xs text-slate-500">Hierarchical Agent Playground</span>
      </div>

      <div className="flex items-center gap-2">
        {activeRun && (
          <div className="flex items-center gap-2 bg-violet-950/40 border border-violet-700/60 rounded px-2 py-1">
            <span className="text-[10px] text-violet-400">Debugging</span>
            <span className="text-[10px] font-mono text-violet-300">{activeRun.query.slice(0, 40)}…</span>
            <button
              type="button"
              onClick={() => setDebugTarget(null)}
              className="text-[10px] text-violet-500 hover:text-violet-300 ml-1"
            >
              ✕
            </button>
          </div>
        )}
        <span className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-400">
          gpt-4.1-mini
        </span>
        <span className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-400">
          mock data
        </span>
      </div>
    </header>
  );
}

export function PlaygroundPage() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <Header />

      <div className="flex flex-1 min-h-0 divide-x divide-slate-800">
        {/* Left: Tree visualization */}
        <div className="flex-1 min-w-0 min-h-0">
          <TreePanel />
        </div>

        {/* Middle: Debug panel */}
        <div className="w-80 shrink-0 min-h-0 overflow-hidden flex flex-col">
          <TracePanel />
        </div>

        {/* Right: Chat */}
        <div className="w-96 shrink-0 min-h-0 overflow-hidden flex flex-col">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
