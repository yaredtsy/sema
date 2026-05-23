import { MessageInput } from "@/features/chat/MessageInput";
import { MessageList } from "@/features/chat/MessageList";

export function ChatPanel() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">Chat</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-400">
            gpt-4.1-mini
          </span>
          <span className="text-[10px] bg-emerald-950/60 border border-emerald-700 rounded px-2 py-0.5 text-emerald-400">
            example-cs
          </span>
        </div>
      </div>
      <MessageList />
      <MessageInput />
    </div>
  );
}
