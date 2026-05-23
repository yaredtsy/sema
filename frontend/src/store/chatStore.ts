import { create } from "zustand";
import { allMockConversations, allMockRuns } from "@/data/mockData";
import type { Conversation, ConvMessage, AgentRun } from "@/data/mockData";

export const MODELS = ["gpt-4.1-mini", "gpt-4o-mini"] as const;
export type Model = (typeof MODELS)[number];

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string;
  model: Model;

  // derived helpers
  activeConversation: () => Conversation;
  messages: () => ConvMessage[];

  // actions
  switchConversation: (id: string) => void;
  createConversation: () => void;
  addMessage: (message: ConvMessage) => void;
  setModel: (model: Model) => void;
}

const NEW_CONV_TEMPLATE = (): Conversation => ({
  id: `conv-${Date.now()}`,
  tree_id: "example-cs",
  created_at: new Date().toISOString(),
  messages: [],
});

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: allMockConversations,
  activeConversationId: allMockConversations[0].id,
  model: "gpt-4.1-mini",

  activeConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? conversations[0];
  },

  messages: () => get().activeConversation().messages,

  switchConversation: (id) => set({ activeConversationId: id }),

  createConversation: () => {
    const conv = NEW_CONV_TEMPLATE();
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: conv.id,
    }));
  },

  addMessage: (message) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === s.activeConversationId
          ? { ...c, messages: [...c.messages, message] }
          : c,
      ),
    })),

  setModel: (model) => set({ model }),
}));

// Keep traceStore seeded with all known runs
export { allMockRuns };
export type { ConvMessage, Conversation, AgentRun };
