/**
 * Visible badge so that screenshots taken in demo mode are unambiguous.
 * The rest of the playground renders normally; only the data source flips
 * (still mocks today; Phase 1 adds the real path).
 */
export function DemoBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-1 border-b border-amber-800/50 bg-amber-950/30 shrink-0">
      <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
        Demo
      </span>
      <span className="text-[10px] text-amber-300/80">
        Mock data, no backend. Pass <code>?tree=&lt;id&gt;</code> for a real tree.
      </span>
    </div>
  );
}
