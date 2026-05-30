/**
 * Chat-domain types: per-conversation messages and the model picker.
 *
 * Today's shape mirrors the mock conversation in `playground/mocks/`. When
 * the real persistence lands ([06-chat-history.md]) the same shape is
 * returned by `GET /conversations/:id`; the LangGraph-typed render of tool
 * calls is layered on top in Phase 4.
 */

/** Mini-models allowed today. Source of truth for the picker, mirrored on the server. */
export const MODELS = ["gpt-4.1-mini", "gpt-4o-mini"] as const;
export type Model = (typeof MODELS)[number];

export interface ConvMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Links an assistant message back to the agent run that produced it. */
  run_id?: string;
  status: "completed" | "streaming" | "pending";
  created_at: string;
}

export interface Conversation {
  id: string;
  tree_id: string;
  created_at: string;
  messages: ConvMessage[];
}
