import type { AnswerComposition } from "../types";

export function AnswerSection({
  finalAnswer,
  model,
  answer,
}: {
  finalAnswer: string;
  model: string;
  answer: Pick<AnswerComposition, "latency_ms" | "input_tokens" | "output_tokens">;
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
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">
        {finalAnswer.slice(0, 280)}…
      </p>
    </div>
  );
}
