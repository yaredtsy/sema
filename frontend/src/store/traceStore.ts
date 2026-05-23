import { create } from "zustand";
import { mockRuns } from "@/data/mockData";
import type { AgentRun } from "@/data/mockData";

interface TraceState {
  runs: Record<string, AgentRun>;
  getRun: (runId: string) => AgentRun | undefined;
  addRun: (run: AgentRun) => void;
}

export const useTraceStore = create<TraceState>(() => ({
  runs: mockRuns,
  getRun: (runId) => useTraceStore.getState().runs[runId],
  addRun: (run) =>
    useTraceStore.setState((s) => ({ runs: { ...s.runs, [run.run_id]: run } })),
}));

export type { AgentRun };
