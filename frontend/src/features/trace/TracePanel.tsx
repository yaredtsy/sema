import { useTraceStore } from "@/store/traceStore";
import { StepCard } from "@/features/trace/StepCard";

export function TracePanel() {
  const runId = useTraceStore((s) => s.runId);
  const steps = useTraceStore((s) => s.steps);

  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-500">
        {runId ? `Run: ${runId}` : "No active run."}
      </p>
      {steps.length === 0 ? (
        <p className="text-slate-600">Steps appear here during traversal.</p>
      ) : (
        steps.map((step) => <StepCard key={step.step_idx} step={step} />)
      )}
    </div>
  );
}
