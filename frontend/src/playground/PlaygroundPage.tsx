import { Spinner } from "@/components/Spinner";
import { PlaygroundShell, EmptyState, ErrorBox } from "./common";
import { usePlaygroundParams } from "./features/url-state";
import { usePlaygroundTree } from "./hooks/usePlaygroundTree";

/**
 * Route component. Per [03-folder-structure.md] rule #6 this is glue, not
 * logic: parse params, decide which top-level view to show, hand off.
 *
 * Branching order matches the URL contract in [02-url-and-entry.md]:
 *   1. demo overrides everything (it's the loud screenshot mode);
 *   2. no tree id  → EmptyState;
 *   3. fetch state → Spinner / ErrorBox;
 *   4. ready       → Shell.
 */
export function PlaygroundPage() {
  const { tree: treeId, demo, embed } = usePlaygroundParams();
  const { data: tree, isLoading, isError, error, refetch } = usePlaygroundTree();

  if (!treeId && !demo) return <EmptyState />;

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <Spinner />
      </div>
    );
  }

  if (isError || !tree) {
    const message =
      error instanceof Error ? error.message : "The tree could not be loaded.";
    return (
      <ErrorBox
        title="Couldn't load this tree"
        detail={message}
        onRetry={refetch}
      />
    );
  }

  return <PlaygroundShell tree={tree} embed={Boolean(embed)} demo={Boolean(demo)} />;
}
