/**
 * Client-side id minting for optimistic inserts.
 *
 * Real ids come from the server. These exist so the chat store can render an
 * outgoing message *before* the round-trip completes. The `tmp-` prefix is
 * the convention used to swap an optimistic record for its server-issued
 * counterpart (see `useSendMessage` once Phase 4 lands).
 */
let counter = 0;

export function tempId(kind: "msg" | "run" | "conv" = "msg"): string {
  counter += 1;
  return `tmp-${kind}-${Date.now().toString(36)}-${counter}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith("tmp-");
}
