import { Link } from "react-router-dom";

/**
 * Fullscreen failure surface for the playground.
 *
 * Used when the tree fetch errors out (network down, 404, server crash).
 * Offers a retry and a way back to the tree list — destinations matter
 * because the playground can't usefully render anything else.
 */
export function ErrorBox({
  title = "Couldn't load the playground",
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-950 text-slate-300 gap-3">
      <div className="text-center space-y-2 max-w-md px-6">
        <p className="text-base text-rose-400">{title}</p>
        {detail && <p className="text-sm text-slate-500 break-words">{detail}</p>}
        <div className="flex items-center justify-center gap-3 pt-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
            >
              Retry
            </button>
          )}
          <Link
            to="/"
            className="text-sm text-slate-400 hover:text-slate-200 underline"
          >
            Back to tree list
          </Link>
        </div>
      </div>
    </div>
  );
}
