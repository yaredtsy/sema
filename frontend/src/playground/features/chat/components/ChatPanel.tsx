import { useChatStore } from "../../../stores/useChatStore";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

/**
 * Outer-right region: header (active conv + model badges), transcript, composer.
 */
export function ChatPanel() {
  const model = useChatStore((s) => s.model);
  const activeConversation = useChatStore((s) => s.activeConversation());

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-300 shrink-0">Chat</span>
          <span className="text-[10px] text-slate-600 truncate">{activeConversation.id}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] bg-sky-950/60 border border-sky-800 rounded px-2 py-0.5 text-sky-400 font-mono">
            {model}
          </span>
          <span className="text-[10px] bg-emerald-950/60 border border-emerald-800 rounded px-2 py-0.5 text-emerald-400">
            {activeConversation.tree_id}
          </span>
        </div>
      </div>
      <MessageList />
      <Composer />
    </div>
  );
}
