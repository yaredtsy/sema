import { MessageInput } from "@/features/chat/MessageInput";
import { MessageList } from "@/features/chat/MessageList";

export function ChatPanel() {
  return (
    <div className="flex h-full flex-col gap-3">
      <MessageList />
      <MessageInput />
    </div>
  );
}
