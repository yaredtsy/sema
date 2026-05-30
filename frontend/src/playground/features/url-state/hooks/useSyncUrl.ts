import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  extractUnknownParams,
  parsePlaygroundUrl,
  serializePlaygroundUrl,
} from "../lib/codec";
import type { PlaygroundParams } from "../types";

type UpdateMode = "push" | "replace";

export interface UrlUpdater {
  /** Merge a partial patch into the current params and write it back. */
  update: (patch: Partial<PlaygroundParams>, mode?: UpdateMode) => void;
  /** Replace the entire param set (still preserves unknown keys). */
  set: (next: PlaygroundParams, mode?: UpdateMode) => void;
}

/**
 * Imperative URL writer.
 *
 * Per [02-url-and-entry.md](../../../../../docs/06-frontend/playground/02-url-and-entry.md#url-↔-state-mapping):
 * `push` on intent (switching conversation), `replace` on incidental
 * (focusing a message). Default is `replace` to keep history clean.
 */
export function useSyncUrl(): UrlUpdater {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();

  const write = useCallback(
    (next: PlaygroundParams, mode: UpdateMode) => {
      const preserved = extractUnknownParams(search);
      const qs = serializePlaygroundUrl(next, preserved);
      const target = qs ? `${pathname}?${qs}` : pathname;
      navigate(target, { replace: mode === "replace" });
    },
    [search, pathname, navigate],
  );

  const update = useCallback<UrlUpdater["update"]>(
    (patch, mode = "replace") => {
      const current = parsePlaygroundUrl(search);
      write({ ...current, ...patch }, mode);
    },
    [search, write],
  );

  const set = useCallback<UrlUpdater["set"]>(
    (next, mode = "replace") => write(next, mode),
    [write],
  );

  return { update, set };
}
