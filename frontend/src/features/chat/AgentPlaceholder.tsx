export function AgentPlaceholder() {
  return (
    <div className="flex h-full flex-col justify-between gap-4 text-sm">
      <div className="space-y-2 text-slate-500">
        <p className="text-slate-400">Agent (coming soon)</p>
        <p>
          The tree-walking agent will run here: ask a question, watch the route on the map,
          and read the answer. For now this panel is a placeholder.
        </p>
      </div>
      <form className="flex gap-2 opacity-50" onSubmit={(e) => e.preventDefault()}>
        <input
          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
          placeholder="Ask something… (disabled)"
          disabled
        />
        <button
          type="submit"
          className="rounded bg-slate-700 px-3 py-1 font-medium"
          disabled
        >
          Send
        </button>
      </form>
    </div>
  );
}
