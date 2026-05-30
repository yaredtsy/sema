/**
 * Highlight category for a node in the canvas overlay.
 *
 * The mapping `cursor > step > visited` reflects display priority — if a
 * node is the cursor AND on the visited path, it renders as "cursor".
 */
export type HighlightKind = "cursor" | "visited" | "step";

export interface HighlightInputs {
  cursorId: string | null;
  visitedIds: Iterable<string>;
  /** Node id of the currently focused trace step, if any. */
  stepNodeId: string | null;
}

export function classifyNode(
  nodeId: string,
  { cursorId, visitedIds, stepNodeId }: HighlightInputs,
  visitedSet: Set<string> = new Set(visitedIds),
): HighlightKind | undefined {
  if (stepNodeId && nodeId === stepNodeId) return "step";
  if (nodeId === cursorId) return "cursor";
  if (visitedSet.has(nodeId)) return "visited";
  return undefined;
}
