import { useChatStore } from "@/store/chatStore";
import { useTraceStore } from "@/store/traceStore";
import { useUiStore } from "@/store/uiStore";
import { StepCard } from "./StepCard";
import { cn } from "@/lib/cn";
import type { DebugMode } from "@/store/uiStore";

function AnswerSection({ finalAnswer, model, answer }: {
  finalAnswer: string;
  model: string;
  answer: { latency_ms: number; input_tokens: number; output_tokens: number };
}) {
  return (
    <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-emerald-400 font-medium">Final Answer</span>
        <div className="flex gap-3 text-[10px] text-slate-500 font-mono">
          <span>in: {answer.input_tokens}</span>
          <span>out: {answer.output_tokens}</span>
          <span>{answer.latency_ms}ms</span>
          <span className="text-slate-600">{model}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{finalAnswer.slice(0, 280)}…</p>
    </div>
  );
}

export function TracePanel() {
  const messages = useChatStore((s) => s.messages());
  const runs = useTraceStore((s) => s.runs);
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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

      {/* Message selector */}
      <div className="px-3 py-2 border-b border-slate-800">
        <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">
          Debug target — pick a message
        </div>
        <div className="space-y-1">
          {assistantMessages.map((msg) => {
            const run = runs[msg.run_id!];
            if (!run) return null;
            const userMsg = userMessageFor(msg.run_id!);
            const isActive = debugTarget === msg.run_id;
            return (
              <button
                key={msg.run_id}
                type="button"
                onClick={() => setDebugTarget(isActive ? null : msg.run_id!)}
                className={cn(
                  "w-full text-left rounded border px-2 py-1.5 transition-all text-xs",
                  isActive
                    ? "border-violet-500 bg-violet-950/40 text-slate-200"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 font-mono">{msg.run_id}</span>
                  <span className={cn(
                    "text-[9px] rounded px-1 border",
                    run.status === "completed"
                      ? "border-emerald-700 text-emerald-400"
                      : "border-slate-600 text-slate-400",
                  )}>
                    {run.status}
                  </span>
                  <span className="text-[10px] text-slate-600">{run.trace.length} steps</span>
                </div>
                <div className="mt-0.5 truncate text-slate-300">{userMsg?.content ?? run.query}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Steps area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {!activeRun && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600">Select a message above</p>
            <p className="text-xs text-slate-700 mt-1">to see the agent's routing steps</p>
          </div>
        )}

        {activeRun && (
          <>
            {/* Run metadata */}
            <div className="rounded bg-slate-800/40 border border-slate-700/50 px-3 py-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
              <span className="font-mono">{activeRun.model}</span>
              <span>{activeRun.trace.length} routing steps</span>
              <span>cursor: <span className="text-slate-400">{activeRun.cursor_id}</span></span>
              <span className="capitalize">{activeRun.stop_reason}</span>
            </div>

            {/* Trace steps */}
            {activeRun.trace.map((step) => (
              <StepCard
                key={step.step_idx}
                step={step}
                isSelected={selectedStepIdx === step.step_idx}
                onClick={() =>
                  setSelectedStepIdx(
                    selectedStepIdx === step.step_idx ? null : step.step_idx,
                  )
                }
              />
            ))}

            {/* Answer summary */}
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
