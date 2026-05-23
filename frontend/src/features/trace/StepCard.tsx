import type { TraceStep } from "@/store/traceStore";

interface StepCardProps {
  step: TraceStep;
}

export function StepCard({ step }: StepCardProps) {
  return (
    <div className="rounded border border-slate-800 p-2">
      <div className="text-xs text-slate-500">Step {step.step_idx}</div>
      {step.node_id && <div className="text-slate-300">{step.node_id}</div>}
    </div>
  );
}
