/**
 * Overlay legend explaining the canvas highlight colors during an active run.
 */
export function Legend({ stepIdx }: { stepIdx: number | null }) {
  return (
    <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
      <span className="rounded px-2 py-0.5 text-[10px] bg-sky-950/80 border border-sky-700 text-sky-300">
        visited
      </span>
      <span className="rounded px-2 py-0.5 text-[10px] bg-amber-950/80 border border-amber-600 text-amber-300">
        final cursor
      </span>
      {stepIdx !== null && (
        <span className="rounded px-2 py-0.5 text-[10px] bg-violet-950/80 border border-violet-600 text-violet-300">
          step {stepIdx}
        </span>
      )}
    </div>
  );
}
