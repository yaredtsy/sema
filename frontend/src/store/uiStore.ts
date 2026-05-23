import { create } from "zustand";

interface UiState {
  selectedNodeId: string | null;
  tracePanelOpen: boolean;
  setSelectedNodeId: (id: string | null) => void;
  setTracePanelOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  tracePanelOpen: true,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setTracePanelOpen: (tracePanelOpen) => set({ tracePanelOpen }),
}));
