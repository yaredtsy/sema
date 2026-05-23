import { useChatStore } from "@/store/chatStore";

export function MessageList() {
  const messages = useChatStore((s) => s.messages);

  if (messages.length === 0) {
    return <p className="text-sm text-slate-500">Ask a question about a tree.</p>;
  }

  return (
    <ul className="flex-1 space-y-2 overflow-auto text-sm">
      {messages.map((m) => (
        <li
          key={m.id}
          className={
            m.role === "user"
              ? "rounded bg-slate-800 px-2 py-1 text-slate-100"
              : "rounded border border-slate-800 px-2 py-1 text-slate-300"
          }
        >
          {m.content}
        </li>
      ))}
    </ul>
  );
}
