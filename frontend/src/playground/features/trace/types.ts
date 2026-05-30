/**
 * Trace-domain types: the shape of an agent's run.
 *
 * A `AgentRun` is the complete record of one agent invocation — every LLM
 * call it made, every routing decision, the final answer. The trace panel
 * renders this; the tree canvas reads `visited_ids` / `cursor_id` for the
 * overlay; the chat bubbles point back to it through `Message.run_id`.
 *
 * These are mock-shaped today. When the agent ships ([07-agent-wiring.md]),
 * the runtime shape is the same; the reducer fills it event-by-event.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Decision {
  kind: "descend" | "answer" | "stay";
  child_id?: string;
  reasoning: string;
  confidence: number;
}

export interface TraceStepFull {
  step_idx: number;
  node_id: string;
  messages_in: LLMMessage[];
  raw_output: string;
  thinking: { text: string };
  decision: Decision;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
}

export interface AnswerComposition {
  messages_in: LLMMessage[];
  raw_output: string;
  final_text: string;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
}

export interface AgentRun {
  run_id: string;
  conversation_id: string;
  message_id: string;
  tree_id: string;
  query: string;
  model: string;
  status: "completed" | "running" | "error";
  cursor_id: string;
  visited_ids: string[];
  trace: TraceStepFull[];
  answer: AnswerComposition;
  final_answer: string;
  stop_reason: "leaf" | "max_depth" | "answer";
  started_at: string;
  finished_at: string;
}
