import { create } from "zustand";

export type DebugMode = "chat" | "tree";

interface UiState {
  selectedNodeId: string | null;
  debugTarget: string | null; // run_id currently being debugged
  debugMode: DebugMode;
  selectedStepIdx: number | null;
  setSelectedNodeId: (id: string | null) => void;
  setDebugTarget: (runId: string | null) => void;
  setDebugMode: (mode: DebugMode) => void;
  setSelectedStepIdx: (idx: number | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  debugTarget: null,
  debugMode: "chat",
  selectedStepIdx: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setDebugTarget: (debugTarget) => set({ debugTarget, selectedStepIdx: null }),
  setDebugMode: (debugMode) => set({ debugMode }),
  setSelectedStepIdx: (selectedStepIdx) => set({ selectedStepIdx }),
}));
