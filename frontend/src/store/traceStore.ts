import { create } from "zustand";

export interface TraceStep {
  step_idx: number;
  node_id?: string;
  payload?: Record<string, unknown>;
}

interface TraceState {
  runId: string | null;
  steps: TraceStep[];
  setRunId: (runId: string | null) => void;
  addStep: (step: TraceStep) => void;
  reset: () => void;
}

export const useTraceStore = create<TraceState>((set) => ({
  runId: null,
  steps: [],
  setRunId: (runId) => set({ runId }),
  addStep: (step) => set((s) => ({ steps: [...s.steps, step] })),
  reset: () => set({ runId: null, steps: [] }),
}));
