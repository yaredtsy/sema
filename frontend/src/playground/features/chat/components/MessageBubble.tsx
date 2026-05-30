import ReactMarkdown from "react-markdown";
import type { ConvMessage } from "../types";
import { RouteSummary } from "./RouteSummary";

export function UserBubble({ msg }: { msg: ConvMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-sky-700/80 px-3 py-2 text-sm text-sky-50">
        {msg.content}
      </div>
    </div>
  );
}

export function AssistantBubble({ msg }: { msg: ConvMessage }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="prose prose-invert prose-sm max-w-none text-slate-200 text-sm leading-relaxed">
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>
      {msg.run_id && <RouteSummary runId={msg.run_id} />}
    </div>
  );
}
