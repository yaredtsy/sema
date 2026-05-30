import type { Conversation } from "../features/chat/types";
import { allMockRuns } from "./runs";

/**
 * Two seed conversations against the example tree. Assistant messages
 * deliberately duplicate the `final_answer` from the run they reference —
 * mirroring the on-the-wire shape where the chat endpoint stores the
 * rendered text and the run is fetched lazily by the trace panel.
 */

const CONVERSATION_01: Conversation = {
  id: "conv-01",
  tree_id: "example-cs",
  created_at: "2026-05-23T10:00:00Z",
  messages: [
    {
      id: "msg-01",
      role: "user",
      content: "How does Python's asyncio event loop work?",
      status: "completed",
      created_at: "2026-05-23T10:01:00Z",
    },
    {
      id: "msg-02",
      role: "assistant",
      content: allMockRuns["run-01"].final_answer,
      run_id: "run-01",
      status: "completed",
      created_at: "2026-05-23T10:01:03Z",
    },
    {
      id: "msg-03",
      role: "user",
      content: "What is Dijkstra's algorithm and when should I use it?",
      status: "completed",
      created_at: "2026-05-23T10:03:00Z",
    },
    {
      id: "msg-04",
      role: "assistant",
      content: allMockRuns["run-02"].final_answer,
      run_id: "run-02",
      status: "completed",
      created_at: "2026-05-23T10:03:02Z",
    },
    {
      id: "msg-05",
      role: "user",
      content: "Explain Rust's borrow checker",
      status: "completed",
      created_at: "2026-05-23T10:05:00Z",
    },
    {
      id: "msg-06",
      role: "assistant",
      content: allMockRuns["run-03"].final_answer,
      run_id: "run-03",
      status: "completed",
      created_at: "2026-05-23T10:05:02Z",
    },
  ],
};

const CONVERSATION_02: Conversation = {
  id: "conv-02",
  tree_id: "example-cs",
  created_at: "2026-05-24T09:00:00Z",
  messages: [
    {
      id: "msg-b01",
      role: "user",
      content: "How does dynamic programming differ from recursion?",
      status: "completed",
      created_at: "2026-05-24T09:00:00Z",
    },
    {
      id: "msg-b02",
      role: "assistant",
      content: allMockRuns["run-04"].final_answer,
      run_id: "run-04",
      status: "completed",
      created_at: "2026-05-24T09:00:02Z",
    },
    {
      id: "msg-b03",
      role: "user",
      content: "What's the difference between process and thread scheduling in an OS?",
      status: "completed",
      created_at: "2026-05-24T09:02:00Z",
    },
    {
      id: "msg-b04",
      role: "assistant",
      content: allMockRuns["run-05"].final_answer,
      run_id: "run-05",
      status: "completed",
      created_at: "2026-05-24T09:02:02Z",
    },
  ],
};

export const allMockConversations: Conversation[] = [CONVERSATION_01, CONVERSATION_02];
