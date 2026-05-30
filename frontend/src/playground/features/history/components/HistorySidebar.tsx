import { useChatStore } from "../../../stores/useChatStore";
import { useUiStore } from "../../../stores/useUiStore";
import { useRunsStore } from "../../../stores/useRunsStore";
import { MODELS, type Model } from "../../chat/types";
import { cn } from "@/lib/cn";

/**
 * Left rail: conversations for the current tree.
 *
 * Phase 0 keeps the legacy in-sidebar model picker so the playground renders
 * identically. Phase 3 moves the picker into the Composer; the brand /
 * model rows here drop out at the same time.
 */

function ModelPill({
  model,
  active,
  onClick,
}: {
  model: Model;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded py-1.5 text-[11px] font-medium transition-colors",
        active
          ? "bg-sky-700 text-white"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
      )}
    >
      {model}
    </button>
  );
}

interface ConvSummaryProps {
  conv: { id: string; created_at: string; messages: Array<{ role: string; content: string }> };
  active: boolean;
  onClick: () => void;
}

function ConversationItem({ conv, active, onClick }: ConvSummaryProps) {
  const firstUser = conv.messages.find((m) => m.role === "user");
  const label = firstUser ? firstUser.content.slice(0, 48) : "Empty conversation";
  const date = new Date(conv.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const userMessageCount = conv.messages.filter((m) => m.role === "user").length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg px-3 py-2.5 transition-colors group",
        active
          ? "bg-slate-700/70 text-slate-100"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
      )}
    >
      <div className="text-xs font-medium truncate leading-snug">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="text-[10px] text-slate-600">{date}</span>
        <span className="text-[10px] text-slate-700">·</span>
        <span className="text-[10px] text-slate-600">{userMessageCount} messages</span>
      </div>
    </button>
  );
}

export function HistorySidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const model = useChatStore((s) => s.model);
  const switchConversation = useChatStore((s) => s.switchConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const setModel = useChatStore((s) => s.setModel);
  const setDebugTarget = useUiStore((s) => s.setDebugTarget);
  const runs = useRunsStore((s) => s.runs);

  // Clearing the debug target on conversation switches keeps the trace panel
  // from showing a run that doesn't belong to the visible conversation.
  const handleSwitch = (id: string) => {
    switchConversation(id);
    setDebugTarget(null);
  };

  const handleNew = () => {
    createConversation();
    setDebugTarget(null);
  };

  const runCountFor = (convId: string) =>
    Object.values(runs).filter((r) => r.conversation_id === convId).length;

  return (
    <div className="flex flex-col h-full w-56 bg-slate-950 border-r border-slate-800">
      <div className="px-4 py-3 border-b border-slate-800/60">
        <div className="text-sm font-bold text-slate-100 tracking-tight">sace</div>
        <div className="text-[10px] text-slate-600 mt-0.5">Hierarchical Agent Playground</div>
      </div>

      <div className="px-3 pt-3 pb-2">
        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5 px-0.5">
          Model
        </div>
        <div className="flex gap-1">
          {MODELS.map((m) => (
            <ModelPill key={m} model={m} active={model === m} onClick={() => setModel(m)} />
          ))}
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 py-2 text-xs text-slate-500 hover:border-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New conversation
        </button>
      </div>

      <div className="px-3 mb-1">
        <div className="text-[10px] text-slate-600 uppercase tracking-wider px-0.5">
          Conversations
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 min-h-0">
        {conversations.map((conv) => {
          const runCount = runCountFor(conv.id);
          return (
            <div key={conv.id} className="relative">
              <ConversationItem
                conv={conv}
                active={conv.id === activeId}
                onClick={() => handleSwitch(conv.id)}
              />
              {runCount > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-500 pointer-events-none">
                  {runCount} runs
                </span>
              )}
            </div>
          );
        })}

        {conversations.length === 0 && (
          <p className="text-xs text-slate-700 text-center py-4">No conversations yet</p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-800/60">
        <div className="text-[10px] text-slate-700 text-center">mock data · no backend</div>
      </div>
    </div>
  );
}
