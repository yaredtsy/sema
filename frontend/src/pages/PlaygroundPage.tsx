import { TreePanel } from "@/features/tree/TreePanel";
import { TracePanel } from "@/features/trace/TracePanel";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { ConversationSidebar } from "@/features/chat/ConversationSidebar";
import { useUiStore } from "@/store/uiStore";
import { useTraceStore } from "@/store/traceStore";
import { cn } from "@/lib/cn";

function DebugBanner() {
  const debugTarget = useUiStore((s) => s.debugTarget);
  const runs = useTraceStore((s) => s.runs);
  const setDebugTarget = useUiStore((s) => s.setDebugTarget);
  const activeRun = debugTarget ? runs[debugTarget] : null;

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

function SidebarToggle() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  return (
    <button
      type="button"
      onClick={() => setSidebarOpen(!sidebarOpen)}
      title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center",
        "w-4 h-12 rounded-r border-y border-r border-slate-700 bg-slate-900 text-slate-600",
        "hover:bg-slate-800 hover:text-slate-300 transition-colors",
        sidebarOpen && "left-56",
      )}
    >
      {sidebarOpen ? "‹" : "›"}
    </button>
  );
}

export function PlaygroundPage() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <DebugBanner />

      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar toggle */}
        <SidebarToggle />

        {/* Conversation sidebar */}
        <div
          className={cn(
            "shrink-0 overflow-hidden transition-all duration-200",
            sidebarOpen ? "w-56" : "w-0",
          )}
        >
          {sidebarOpen && <ConversationSidebar />}
        </div>

        {/* Main area */}
        <div className="flex flex-1 min-w-0 min-h-0 divide-x divide-slate-800">
          {/* Tree visualization */}
          <div className="flex-1 min-w-0 min-h-0">
            <TreePanel />
          </div>

          {/* Debug panel */}
          <div className="w-80 shrink-0 min-h-0 overflow-hidden flex flex-col">
            <TracePanel />
          </div>

          {/* Chat */}
          <div className="w-96 shrink-0 min-h-0 overflow-hidden flex flex-col">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
