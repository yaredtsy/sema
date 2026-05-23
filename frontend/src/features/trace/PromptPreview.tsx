/** Toggle to see raw prompt (stub). */
export function PromptPreview({ prompt }: { prompt?: string }) {
  if (!prompt) return null;
  return (
    <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-400">
      {prompt}
    </pre>
  );
}
