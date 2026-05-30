import { create } from "zustand";
import type { AgentRun } from "../features/trace/types";
import { allMockRuns } from "../mocks/runs";

/**
 * Live, SSE-backed runs by `run_id`.
 *
 * Phase 0 keeps the mock seed so the trace panel renders end-to-end. From
 * Phase 4 on, this store only holds *in-flight* runs (events arriving from
 * the agent's SSE stream); *completed* runs come from React Query via
 * `useRun`. Splitting by lifetime is the rule that keeps server data from
 * silently duplicating into client memory.
 */

interface RunsState {
  runs: Record<string, AgentRun>;
  addRun: (run: AgentRun) => void;
}

export const useRunsStore = create<RunsState>((set) => ({
  runs: allMockRuns,
  addRun: (run) => set((s) => ({ runs: { ...s.runs, [run.run_id]: run } })),
}));
