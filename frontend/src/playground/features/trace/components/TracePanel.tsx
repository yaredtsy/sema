import { useChatStore } from "../../../stores/useChatStore";
import { useRunsStore } from "../../../stores/useRunsStore";
import { useUiStore, type DebugMode } from "../../../stores/useUiStore";
import { StepCard } from "./StepCard";
import { AnswerSection } from "./AnswerSection";
import { cn } from "@/lib/cn";

/**
 * Inner-right region: debug surface.
 *
 * Lists the conversation's assistant messages as "debug targets", and for
 * the selected target streams its step cards. Today's run data comes from
 * the runs store seeded with mocks; Phase 4 wires `useLiveTrace` + `useRun`.
 */
export function TracePanel() {
  const messages = useChatStore((s) => s.messages());
  const runs = useRunsStore((s) => s.runs);
  const debugTarget = useUiStore((s) => s.debugTarget);
  const debugMode = useUiStore((s) => s.debugMode);
  const selectedStepIdx = useUiStore((s) => s.selectedStepIdx);
  const setDebugTarget = useUiStore((s) => s.setDebugTarget);
  const setDebugMode = useUiStore((s) => s.setDebugMode);
  const setSelectedStepIdx = useUiStore((s) => s.setSelectedStepIdx);

  const assistantMessages = messages.filter((m) => m.role === "assistant" && m.run_id);
  const activeRun = debugTarget ? runs[debugTarget] : null;

  const userMessageFor = (runId: string) => {
    const idx = messages.findIndex((m) => m.run_id === runId);
    return idx > 0 ? messages[idx - 1] : null;
  };

  const toggleStep = (stepIdx: number) =>
    setSelectedStepIdx(selectedStepIdx === stepIdx ? null : stepIdx);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-300">Debug Panel</span>
        <div className="flex rounded border border-slate-700 overflow-hidden text-[10px]">
          {(["chat", "tree"] as DebugMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDebugMode(m)}
              className={cn(
                "px-2 py-1 transition-colors",
                debugMode === m
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              {m === "chat" ? "Step view" : "Tree overlay"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-slate-800">
        <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">
          Debug target — pick a message
        </div>
        <div className="space-y-1">
          {assistantMessages.map((msg) => {
            const runId = msg.run_id!;
            const run = runs[runId];
            if (!run) return null;
            const userMsg = userMessageFor(runId);
            const isActive = debugTarget === runId;
            return (
              <button
                key={runId}
                type="button"
                onClick={() => setDebugTarget(isActive ? null : runId)}
                className={cn(
                  "w-full text-left rounded border px-2 py-1.5 transition-all text-xs",
                  isActive
                    ? "border-violet-500 bg-violet-950/40 text-slate-200"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 font-mono">{runId}</span>
                  <span
                    className={cn(
                      "text-[9px] rounded px-1 border",
                      run.status === "completed"
                        ? "border-emerald-700 text-emerald-400"
                        : "border-slate-600 text-slate-400",
                    )}
                  >
                    {run.status}
                  </span>
                  <span className="text-[10px] text-slate-600">{run.trace.length} steps</span>
                </div>
                <div className="mt-0.5 truncate text-slate-300">
                  {userMsg?.content ?? run.query}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {!activeRun && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600">Select a message above</p>
            <p className="text-xs text-slate-700 mt-1">to see the agent's routing steps</p>
          </div>
        )}

        {activeRun && (
          <>
            <div className="rounded bg-slate-800/40 border border-slate-700/50 px-3 py-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
              <span className="font-mono">{activeRun.model}</span>
              <span>{activeRun.trace.length} routing steps</span>
              <span>
                cursor: <span className="text-slate-400">{activeRun.cursor_id}</span>
              </span>
              <span className="capitalize">{activeRun.stop_reason}</span>
            </div>

            {activeRun.trace.map((step) => (
              <StepCard
                key={step.step_idx}
                step={step}
                isSelected={selectedStepIdx === step.step_idx}
                onClick={() => toggleStep(step.step_idx)}
              />
            ))}

            <AnswerSection
              finalAnswer={activeRun.final_answer}
              model={activeRun.answer.model}
              answer={activeRun.answer}
            />
          </>
        )}
      </div>
    </div>
  );
}
