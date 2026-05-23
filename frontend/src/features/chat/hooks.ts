import { useChatStore } from "@/store/chatStore";
import type { ConvMessage } from "@/data/mockData";

let msgCounter = 100;

export function useSendMessage() {
  const addMessage = useChatStore((s) => s.addMessage);

  return (text: string) => {
    const userMsg: ConvMessage = {
      id: `msg-${++msgCounter}`,
      role: "user",
      content: text,
      status: "completed",
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);

    // Simulate a pending assistant reply (no backend in mock mode)
    const assistantMsg: ConvMessage = {
      id: `msg-${++msgCounter}`,
      role: "assistant",
      content:
        "*(Backend not connected — this is a mock UI. Select a message above in the Debug Panel to explore the agent's reasoning.)*",
      status: "completed",
      created_at: new Date().toISOString(),
    };
    setTimeout(() => addMessage(assistantMsg), 600);
  };
}
