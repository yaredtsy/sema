import { useChatStore } from "../../../stores/useChatStore";
import type { ConvMessage } from "../types";

/**
 * Phase 0 placeholder: emulates a send by inserting a user message and a
 * canned assistant reply after a brief delay. Phase 4 replaces the body
 * with the real `POST /conversations/:cid/messages` + SSE subscription.
 */
let msgCounter = 100;

const nextMsgId = (): string => {
  msgCounter += 1;
  return `msg-${msgCounter}`;
};

const stubReplyContent = (model: string, convId: string): string =>
  `*(${model} · ${convId}) — Backend not connected. This is a mock UI. Use the Debug Panel to explore the agent's reasoning on the pre-loaded conversations.)*`;

export function useSendMessage() {
  const addMessage = useChatStore((s) => s.addMessage);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const model = useChatStore((s) => s.model);

  return (text: string) => {
    const now = new Date().toISOString();

    const userMsg: ConvMessage = {
      id: nextMsgId(),
      role: "user",
      content: text,
      status: "completed",
      created_at: now,
    };
    addMessage(userMsg);

    const assistantMsg: ConvMessage = {
      id: nextMsgId(),
      role: "assistant",
      content: stubReplyContent(model, activeConversationId),
      status: "completed",
      created_at: now,
    };
    setTimeout(() => addMessage(assistantMsg), 600);
  };
}
