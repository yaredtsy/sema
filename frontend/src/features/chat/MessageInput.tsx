import { useState } from "react";
import { useSendMessage } from "@/features/chat/hooks";

export function MessageInput() {
  const [text, setText] = useState("");
  const sendMessage = useSendMessage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    sendMessage(q);
    setText("");
  };

  return (
    <form className="flex gap-2 p-3 border-t border-slate-800" onSubmit={handleSubmit}>
      <input
        className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-slate-500 focus:outline-none"
        placeholder="Ask about computer science…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 active:bg-sky-800"
      >
        Send
      </button>
    </form>
  );
}
