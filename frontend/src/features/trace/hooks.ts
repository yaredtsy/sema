import { useEffect } from "react";
import { subscribeEvents } from "@/api/events";
import { useTraceStore } from "@/store/traceStore";

export function useLiveTrace(runId: string | null) {
  const addStep = useTraceStore((s) => s.addStep);

  useEffect(() => {
    if (!runId) return;
    const source = subscribeEvents(runId, (ev) => {
      try {
        const data = JSON.parse(ev.data) as { step_idx?: number; node_id?: string };
        if (typeof data.step_idx === "number") {
          addStep({ step_idx: data.step_idx, node_id: data.node_id });
        }
      } catch {
        /* ignore malformed events */
      }
    });
    return () => source.close();
  }, [runId, addStep]);
}
