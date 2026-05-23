import { create } from "zustand";
import { allMockRuns } from "@/data/mockData";
import type { AgentRun } from "@/data/mockData";

interface TraceState {
  runs: Record<string, AgentRun>;
  addRun: (run: AgentRun) => void;
}

export const useTraceStore = create<TraceState>(() => ({
  runs: allMockRuns,
  addRun: (run) =>
    useTraceStore.setState((s) => ({ runs: { ...s.runs, [run.run_id]: run } })),
}));

export type { AgentRun };
