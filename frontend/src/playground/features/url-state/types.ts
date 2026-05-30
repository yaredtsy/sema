/**
 * All playground state expressible through the URL.
 *
 * Every field is optional: a bare `/playground` is a valid (if empty) URL.
 * The codec preserves unknown params verbatim — see codec.ts.
 */
export interface PlaygroundParams {
  /** Tree id. The only "intentful" param — without it we render an empty state. */
  tree?: string;
  /** Active conversation id. Auto-managed by the page after first paint. */
  conv?: string;
  /** Assistant message id under inspection (the "debug target"). */
  msg?: string;
  /** Step index inside the focused message's run (>= 0). */
  step?: number;
  /** Preselected model id for a *new* conversation only. */
  model?: string;
  /** Iframe / chromeless mode. */
  embed?: boolean;
  /** Force mock-data mode regardless of `tree`. */
  demo?: boolean;
}

/** Keys we know about. Unknown keys are preserved by the codec but not typed. */
export const KNOWN_PARAM_KEYS = [
  "tree",
  "conv",
  "msg",
  "step",
  "model",
  "embed",
  "demo",
] as const;

export type KnownParamKey = (typeof KNOWN_PARAM_KEYS)[number];
