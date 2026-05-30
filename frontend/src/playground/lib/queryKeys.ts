/**
 * Single source of truth for React Query keys used inside the playground.
 *
 * Rule: every feature hook that calls `useQuery` / `useMutation` builds its
 * key here. Components never inline `["tree", id]` style tuples. When the
 * shape of a key needs to change (e.g. add a versioning prefix, or scope by
 * user), it changes in one place.
 *
 * Convention: keys read like a path — `qk.conversation(id)`, not
 * `qk.conversationById(id)`. Functions return readonly tuples so they can be
 * compared by reference / passed to `invalidateQueries`.
 */
export const qk = {
  tree: (treeId: string) => ["tree", treeId] as const,
  conversations: (treeId: string) => ["conversations", treeId] as const,
  conversation: (convId: string) => ["conversation", convId] as const,
  messages: (convId: string) => ["messages", convId] as const,
  run: (runId: string) => ["run", runId] as const,
} as const;

export type QueryKey =
  | ReturnType<typeof qk.tree>
  | ReturnType<typeof qk.conversations>
  | ReturnType<typeof qk.conversation>
  | ReturnType<typeof qk.messages>
  | ReturnType<typeof qk.run>;
