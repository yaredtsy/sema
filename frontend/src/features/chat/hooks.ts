import { useMutation } from "@tanstack/react-query";
import { postQuery } from "@/api/query";
import { useChatStore } from "@/store/chatStore";
import { useTraceStore } from "@/store/traceStore";

export function useSendQuery() {
  const addMessage = useChatStore((s) => s.addMessage);
  const setRunId = useTraceStore((s) => s.setRunId);

  return useMutation({
    mutationFn: postQuery,
    onMutate: (vars) => {
      addMessage({ id: crypto.randomUUID(), role: "user", content: vars.query });
    },
    onSuccess: (data, vars) => {
      setRunId(data.run_id);
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `(run ${data.run_id}) — agent not wired yet.`,
      });
    },
  });
}
