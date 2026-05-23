import { useChatStore } from "@/store/chatStore";
import type { ConvMessage } from "@/data/mockData";

let msgCounter = 100;

export function useSendMessage() {
  const addMessage = useChatStore((s) => s.addMessage);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const model = useChatStore((s) => s.model);

  return (text: string) => {
    const userMsg: ConvMessage = {
      id: `msg-${++msgCounter}`,
      role: "user",
      content: text,
      status: "completed",
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);

    const assistantMsg: ConvMessage = {
      id: `msg-${++msgCounter}`,
      role: "assistant",
      content: `*(${model} · ${activeConversationId}) — Backend not connected. This is a mock UI. Use the Debug Panel to explore the agent's reasoning on the pre-loaded conversations.)*`,
      status: "completed",
      created_at: new Date().toISOString(),
    };
    setTimeout(() => addMessage(assistantMsg), 600);
  };
}
