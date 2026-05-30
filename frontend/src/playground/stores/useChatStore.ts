import { create } from "zustand";
import type { Conversation, ConvMessage, Model } from "../features/chat/types";
import { allMockConversations } from "../mocks/conversations";

/**
 * In-flight / optimistic chat state.
 *
 * Phase 0 keeps the mock-seeded list and the local `addMessage` flow so the
 * UI renders identically to before. Phase 2 strips the seeding and moves
 * committed conversations / messages into React Query; this store then
 * shrinks to: optimistic inserts, send queue, per-conversation drafts.
 */

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string;
  model: Model;

  activeConversation: () => Conversation;
  messages: () => ConvMessage[];

  switchConversation: (id: string) => void;
  createConversation: () => void;
  addMessage: (message: ConvMessage) => void;
  setModel: (model: Model) => void;
}

const newConversationTemplate = (): Conversation => ({
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
    return (
      conversations.find((c) => c.id === activeConversationId) ?? conversations[0]
    );
  },

  messages: () => get().activeConversation().messages,

  switchConversation: (id) => set({ activeConversationId: id }),

  createConversation: () => {
    const conv = newConversationTemplate();
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
