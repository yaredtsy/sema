import { create } from "zustand";
import { mockConversation } from "@/data/mockData";
import type { ConvMessage } from "@/data/mockData";

interface ChatState {
  conversationId: string;
  messages: ConvMessage[];
  addMessage: (message: ConvMessage) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>(() => ({
  conversationId: mockConversation.id,
  messages: mockConversation.messages,
  addMessage: (message) =>
    useChatStore.setState((s) => ({ messages: [...s.messages, message] })),
  clear: () => useChatStore.setState({ messages: [] }),
}));

export type { ConvMessage };
