# Core concepts & vocabulary

The rest of the docs use these terms with precise meaning. Read this page first. Where it helps, the GPS-history metaphor (see [01-vision.md](./01-vision.md)) is in parentheses.

## Knowledge model

### Node *(a place on the map)*

The atomic unit of knowledge. Every node has the same shape:

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Stable identifier (e.g. `programming.languages.python.async`) |
| `title` | string | Short label, shown in the tree viz and used in the routing prompt |
| `description` | string | One-line summary, used by the agent to decide whether to descend |
| `detail` | string (markdown) | The long-form content. Only consumed when the agent **arrives** at a node |
| `children` | `Node[]` | Sub-nodes (recursive) |

Three text fields with different roles, on purpose — see [02-data-model/01-node-schema.md](../02-data-model/01-node-schema.md).

### Tree / Dendrogram *(the map)*

A rooted tree of `Node`s. The intent is **progressive refinement** — each level narrows the topic. Sibling nodes should be roughly orthogonal.

## Conversation model

### Conversation *(your trip history list)*

A series of `Message`s between the user and the agent. One open session in the UI; persists for the duration of the playground process (no DB in v1, but exportable as JSON).

### Message *(a single trip)*

| Field | Meaning |
|---|---|
| `id` | Stable id within the conversation |
| `role` | `user` or `assistant` |
| `content` | The text (rendered markdown for assistant) |
| `run_id` | (assistant only) The agent run that produced this message |
| `created_at` | Timestamp |

A **user message** has no run. An **assistant message** is *always* associated with exactly one `Run` (the trip the agent took to produce it).

### Run *(one drive from A to B)*

The agent's execution for one user message. A run contains:
- `query` — the user message text
- `cursor` history — which nodes were visited
- `trace` — the ordered list of steps (see below)
- `final_answer`
- `stop_reason`
- model + timing totals

A run is a complete record. Saved, replayable. The `AgentState` IS the run.

### Step *(one turn during the drive)*

One iteration of the agent loop:
- The node the agent was at when it decided
- The prompt sent
- The LLM's raw output
- The thinking / CoT, if any
- Tool calls, if any
- The parsed decision (`descend(child_id)` or `stop`)
- Latency, token count, model name

Steps are what stream over SSE and what render in the debug panel.

### Trace *(the route)*

The ordered list of steps for one run. A trace plus the visited cursors *is* the route on the map.

## Debugging concepts

### Debug target *(which trip you're inspecting)*

The currently selected assistant message in the chat. Both the debug panel and the tree-overlay view reflect this target. The "Live" target is a special case: the message currently streaming.

### Debug view *(how you're looking at the trip)*

Two synchronized views of the same target:

- **Chat-style view** — the assistant message expands inline to show its thinking, tool calls, step-by-step decisions, and final answer. Cursor-like.
- **Tree-overlay view** — the tree highlights visited nodes; selecting a node shows its prompt context, messages, decision. Map-like.

You can switch views any time; the target persists. See [06-frontend/04-debug-panel.md](../06-frontend/04-debug-panel.md) and [06-frontend/05-tree-overlay-debug.md](../06-frontend/05-tree-overlay-debug.md).

### Live mode vs. replay mode

- **Live** — the SSE stream is open; events arrive in real time; the debug target is the streaming message.
- **Replay** — no live stream; views are projected from a saved `AgentState`. Scrubbing through steps is enabled.

The transition is seamless: when an SSE `done` event arrives, the live run becomes a replay-able past trip just by virtue of being saved.

## Agent concepts

### Traversal

The agent's primary action. Starting from `root`, at each step the agent sees current node + children + the user query, then either:
1. **Descends** into one child, or
2. **Stops** at the current node because it's specific enough to answer.

### Routing decision

A single LLM call that picks the next branch (or stops). The smallest unit of agent behavior. A run is "many routing decisions in a row".

### Context engineering

Everything about how we render the tree into the prompt: XML format, what fields go where, breadcrumbs, examples. See [04-context-engineering/](../04-context-engineering/).

### Small model

OpenAI mini-tier only (`gpt-4.1-mini`, `gpt-4o-mini`). No frontier-model control. The constraint is the experiment.

## Glossary table

| Term | Meaning |
|---|---|
| Node | One item in the tree |
| Tree | The dendrogram (the map) |
| Conversation | A series of user↔agent messages |
| Message | One turn in the conversation |
| Run | The agent's full execution for one user message (one trip) |
| Trace | The ordered steps within a run (the route) |
| Step | One routing decision (one turn during the drive) |
| Debug target | The selected message whose run is being inspected |
| Debug view | How that target is shown (chat-style or tree-overlay) |
| Live / Replay | Streaming vs. projecting from a saved state |
| Event | One message on the SSE stream |
