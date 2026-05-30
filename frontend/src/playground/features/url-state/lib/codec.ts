import { KNOWN_PARAM_KEYS, type PlaygroundParams } from "../types";

/**
 * Pure URL ↔ PlaygroundParams translation.
 *
 * No `window`, no React, no stores — just `string ↔ object`. Every read goes
 * through `parsePlaygroundUrl`; every write through `serializePlaygroundUrl`.
 *
 * Round-trip property: for any `p`,
 *   parsePlaygroundUrl(serializePlaygroundUrl(p)) ≡ p (up to default-dropping).
 *
 * Unknown params are preserved verbatim so older saved URLs survive new
 * codec releases.
 */

/** Parse a query string (with or without leading `?`) into PlaygroundParams. */
export function parsePlaygroundUrl(search: string): PlaygroundParams {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: PlaygroundParams = {};

  const tree = sp.get("tree");
  if (tree) out.tree = tree;

  const conv = sp.get("conv");
  if (conv) out.conv = conv;

  const msg = sp.get("msg");
  if (msg) out.msg = msg;

  const stepRaw = sp.get("step");
  if (stepRaw !== null) {
    const n = Number.parseInt(stepRaw, 10);
    if (Number.isFinite(n) && n >= 0) out.step = n;
  }

  const model = sp.get("model");
  if (model) out.model = model;

  if (sp.get("embed") === "1") out.embed = true;
  if (sp.get("demo") === "1") out.demo = true;

  return out;
}

/**
 * Serialize PlaygroundParams to a query string (no leading `?`).
 *
 * Keys are emitted in `KNOWN_PARAM_KEYS` order so two equivalent param
 * objects produce byte-identical strings (clean for share/copy). Default /
 * empty values are dropped so we don't pollute the URL with `embed=0`-style
 * noise.
 *
 * `preserved` carries unknown params from the current URL through unchanged.
 */
export function serializePlaygroundUrl(
  params: PlaygroundParams,
  preserved?: Record<string, string>,
): string {
  const sp = new URLSearchParams();

  for (const key of KNOWN_PARAM_KEYS) {
    const value = params[key];
    if (value === undefined || value === false || value === "") continue;
    if (key === "embed" || key === "demo") {
      sp.set(key, "1");
    } else {
      sp.set(key, String(value));
    }
  }

  if (preserved) {
    for (const [k, v] of Object.entries(preserved)) {
      if (!sp.has(k)) sp.set(k, v);
    }
  }

  return sp.toString();
}

/** Extract the unknown-key subset from a raw search string. Used to preserve future params. */
export function extractUnknownParams(search: string): Record<string, string> {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const known = new Set<string>(KNOWN_PARAM_KEYS);
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) {
    if (!known.has(k)) out[k] = v;
  }
  return out;
}
