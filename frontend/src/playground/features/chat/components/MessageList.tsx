import { useEffect, useRef } from "react";
import { useChatStore } from "../../../stores/useChatStore";
import { UserBubble, AssistantBubble } from "./MessageBubble";

/**
 * Scrolls to the bottom when a new message arrives. The Phase 4 LiveTurn
 * variant will replace the placeholder assistant bubble while streaming.
 */
export function MessageList() {
  const messages = useChatStore((s) => s.messages());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-600">
        Ask a question about the knowledge tree
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} msg={m} />
        ) : (
          <AssistantBubble key={m.id} msg={m} />
        ),
      )}
      <div ref={bottomRef} />
    </div>
  );
}
