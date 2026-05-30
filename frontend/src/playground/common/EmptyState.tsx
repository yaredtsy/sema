import { Link } from "react-router-dom";

/**
 * Shown when `/playground` is hit without a `tree` param (and not in demo
 * mode). The playground refuses to render without a tree — there is
 * nothing to traverse. See [02-url-and-entry.md] for the rule.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-950 text-slate-300 gap-4">
      <div className="text-center space-y-2 max-w-md px-6">
        <p className="text-base text-slate-200">No tree selected.</p>
        <p className="text-sm text-slate-500">
          The playground needs a knowledge tree to run an agent against.{" "}
          <Link to="/" className="text-sky-400 hover:text-sky-300 underline">
            Pick one from the tree list
          </Link>
          {" "}or pass{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs">?tree=&lt;id&gt;</code>
          {" "}in the URL.
        </p>
        <p className="text-xs text-slate-600 pt-2">
          Or browse the demo:{" "}
          <Link
            to="/playground?demo=1"
            className="text-slate-400 hover:text-slate-200 underline"
          >
            /playground?demo=1
          </Link>
        </p>
      </div>
    </div>
  );
}
