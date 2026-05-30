import type { Tree } from "@/types";
import { cn } from "@/lib/cn";
import { HistorySidebar } from "../features/history";
import { TreeCanvas } from "../features/tree-canvas";
import { TracePanel } from "../features/trace";
import { ChatPanel } from "../features/chat";
import { useUiStore } from "../stores/useUiStore";
import { DebugBanner } from "./DebugBanner";
import { DemoBanner } from "./DemoBanner";

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

/**
 * The four-region playground frame.
 *
 *   ┌──────────────────────────────────────┐
 *   │ Sidebar │   Tree    │ Trace │ Chat  │
 *   │ history │  canvas   │ panel │ panel │
 *   └──────────────────────────────────────┘
 *
 * `embed=1` hides the sidebar entirely (iframe mode). The demo banner is a
 * separate top strip that doesn't affect the grid math.
 */
interface PlaygroundShellProps {
  tree: Tree;
  embed: boolean;
  demo: boolean;
}

export function PlaygroundShell({ tree, embed, demo }: PlaygroundShellProps) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const showSidebar = !embed && sidebarOpen;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {demo && <DemoBanner />}
      <DebugBanner />

      <div className="flex flex-1 min-h-0 relative">
        {!embed && <SidebarToggle />}

        <div
          className={cn(
            "shrink-0 overflow-hidden transition-all duration-200",
            showSidebar ? "w-56" : "w-0",
          )}
        >
          {showSidebar && <HistorySidebar />}
        </div>

        <div className="flex flex-1 min-w-0 min-h-0 divide-x divide-slate-800">
          <div className="flex-1 min-w-0 min-h-0">
            {/* Keying on tree.id resets the canvas's internal ReactFlow state
                (drag positions, selection) when the user switches trees. */}
            <TreeCanvas key={tree.id} tree={tree} />
          </div>
          <div className="w-80 shrink-0 min-h-0 overflow-hidden flex flex-col">
            <TracePanel />
          </div>
          <div className="w-96 shrink-0 min-h-0 overflow-hidden flex flex-col">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
