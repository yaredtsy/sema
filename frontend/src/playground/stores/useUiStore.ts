import { create } from "zustand";

/**
 * UI-lifetime state: survives across mounts inside one tab, dies on tab close.
 *
 * Anything here is intentionally NOT a URL param — see
 * [02-url-and-entry.md#when-the-url-cant-represent-the-state]. URL-mirrored
 * fields (debugTarget ⇄ ?msg, selectedStepIdx ⇄ ?step) gain their mirroring
 * via `useDebugTarget` in Phase 5; the store still owns the in-memory value
 * because URL writes are deferred / batched.
 */

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
  // Changing the debug target invalidates the previously-selected step — it
  // belonged to the old run.
  setDebugTarget: (debugTarget) => set({ debugTarget, selectedStepIdx: null }),
  setDebugMode: (debugMode) => set({ debugMode }),
  setSelectedStepIdx: (selectedStepIdx) => set({ selectedStepIdx }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
