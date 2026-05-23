import { create } from "zustand";

export type DebugMode = "chat" | "tree";

interface UiState {
  selectedNodeId: string | null;
  debugTarget: string | null;
  debugMode: DebugMode;
  selectedStepIdx: number | null;
  sidebarOpen: boolean;

  setSelectedNodeId: (id: string | null) => void;
  setDebugTarget: (runId: string | null) => void;
  setDebugMode: (mode: DebugMode) => void;
  setSelectedStepIdx: (idx: number | null) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  debugTarget: null,
  debugMode: "chat",
  selectedStepIdx: null,
  sidebarOpen: true,

  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setDebugTarget: (debugTarget) => set({ debugTarget, selectedStepIdx: null }),
  setDebugMode: (debugMode) => set({ debugMode }),
  setSelectedStepIdx: (selectedStepIdx) => set({ selectedStepIdx }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
