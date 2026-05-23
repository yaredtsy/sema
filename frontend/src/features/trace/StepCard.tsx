import { useState } from "react";
import { cn } from "@/lib/cn";
import type { TraceStepFull } from "@/data/mockData";

interface StepCardProps {
  step: TraceStepFull;
  isSelected: boolean;
  onClick: () => void;
}

function Foldout({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700/60 rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-400 transition-colors"
      >
        <span>{label}</span>
        <span className="opacity-50">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="p-2">{children}</div>}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400";
  return <span className={cn("font-mono text-[10px]", color)}>{pct}%</span>;
}

function TokensLine({ input, output, latency }: { input: number; output: number; latency: number }) {
  return (
    <div className="flex gap-3 text-[10px] text-slate-500 font-mono">
      <span>in: {input}</span>
      <span>out: {output}</span>
      <span>{latency}ms</span>
    </div>
  );
}

export function StepCard({ step, isSelected, onClick }: StepCardProps) {
  const kindColor = {
    descend: "bg-sky-900/60 text-sky-300 border-sky-700",
    answer: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    stay: "bg-slate-700/60 text-slate-300 border-slate-600",
  }[step.decision.kind];

  return (
    <div
      className={cn(
        "rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-violet-500 bg-violet-950/40 shadow-sm shadow-violet-900/30"
          : "border-slate-700 bg-slate-900 hover:border-slate-600",
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs font-mono text-slate-500">#{step.step_idx}</span>
        <span className="text-xs font-medium text-slate-200 flex-1 truncate">{step.node_id}</span>
        <span className={cn("text-[10px] rounded px-1.5 py-0.5 border", kindColor)}>
          {step.decision.kind}
        </span>
        <ConfidenceBadge value={step.decision.confidence} />
      </div>

      {isSelected && (
        <div className="border-t border-slate-700/60 px-3 py-2 space-y-2">
          {/* Thinking */}
          <Foldout label="💭 Thinking">
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "{step.thinking.text}"
            </p>
          </Foldout>

          {/* Decision */}
          <div className="rounded bg-slate-800/60 p-2 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Decision</div>
            <div className="text-xs text-slate-300">{step.decision.reasoning}</div>
            {step.decision.child_id && (
              <div className="text-xs font-mono text-sky-400">→ {step.decision.child_id}</div>
            )}
          </div>

          {/* Messages sent to LLM */}
          <Foldout label={`📨 Prompt (${step.messages_in.length} messages)`}>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {step.messages_in.map((m, i) => (
                <div key={i} className="rounded bg-slate-900 p-1.5">
                  <div className="text-[10px] text-slate-500 uppercase mb-0.5">{m.role}</div>
                  <pre className="text-[10px] text-slate-400 whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {m.content.length > 400 ? m.content.slice(0, 400) + "…" : m.content}
                  </pre>
                </div>
              ))}
            </div>
          </Foldout>

          {/* Raw output */}
          <Foldout label="📤 Raw output">
            <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
              {step.raw_output}
            </pre>
          </Foldout>

          <TokensLine
            input={step.input_tokens}
            output={step.output_tokens}
            latency={step.latency_ms}
          />
        </div>
      )}
    </div>
  );
}
