import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { parsePlaygroundUrl } from "../lib/codec";
import type { PlaygroundParams } from "../types";

/**
 * Read-only view of the playground URL parameters.
 *
 * Components and feature hooks call this; nobody touches
 * `window.location.search` directly. Recomputes only when the search string
 * actually changes (referential stability matters for downstream memo deps).
 */
export function usePlaygroundParams(): PlaygroundParams {
  const { search } = useLocation();
  return useMemo(() => parsePlaygroundUrl(search), [search]);
}
