import { useState } from "react";
import { useSendQuery } from "@/features/chat/hooks";

export function MessageInput() {
  const [text, setText] = useState("");
  const send = useSendQuery();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = text.trim();
        if (!q) return;
        send.mutate({ tree_id: "example-cs", query: q });
        setText("");
      }}
    >
      <input
        className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        placeholder="Ask something…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        className="rounded bg-sky-600 px-3 py-1 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
        disabled={send.isPending}
      >
        Send
      </button>
    </form>
  );
}
