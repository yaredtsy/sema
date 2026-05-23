# Core concepts & vocabulary

The rest of the docs use these terms with precise meaning. Read this page first.

## Node

The atomic unit of knowledge. Every node has the same shape:

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Stable identifier (e.g. `programming.languages.python.async`) |
| `title` | string | Short label, shown in the tree viz and used in the routing prompt |
| `description` | string | One-line summary, used by the agent to decide whether to descend |
| `detail` | string (markdown) | The long-form content. Only consumed when the agent **arrives** at a node |
| `children` | `Node[]` | Sub-nodes (recursive) |

Three text fields with different roles is on purpose — see [02-data-model/01-node-schema.md](../02-data-model/01-node-schema.md).

## Tree / Dendrogram

A rooted tree of `Node`s. We call it a *dendrogram* because the intent is **progressive refinement**: each level narrows the topic. Sibling nodes should be roughly orthogonal categories.

## Traversal

The agent's primary action. Starting from `root`, at each step the agent sees:
- The current node's `title` + `description`
- Its children's `title` + `description`
- The user's query

It then either:
1. **Descends** into one (or more) children, or
2. **Stops** at the current node because it's specific enough to answer.

## Routing decision

A single LLM call that picks the next branch (or stops). The smallest unit of the agent's behavior. The whole system is "many routing decisions in a row".

## Step

One iteration of the agent loop. A step contains:
- The node visited
- The prompt sent
- The LLM's raw output
- The parsed decision (`descend(child_id)` or `stop`)
- Latency, token count, model name

Steps are what the SSE stream emits. They are what the frontend renders. They are how we debug.

## Trace

The ordered list of steps for one user query. A trace is a tree-walk path plus the LLM's reasoning at each fork.

## Context engineering

Everything about how we render the tree into the prompt. Includes:
- XML vs. JSON vs. bullet format
- How much of the description to include at each level
- Whether siblings of ancestors are visible (peripheral vision)
- Few-shot examples for the routing decision

See [04-context-engineering/](../04-context-engineering/).

## Small model

The hypothesis is that this works with **OpenAI mini-tier models only** (`gpt-4.1-mini`, `gpt-4o-mini`, future mini variants) because each decision is bounded and local. We deliberately do **not** include a frontier-model control — the constraint is the experiment. If mini cannot do it, that is the finding.

## Glossary table

| Term | Meaning |
|---|---|
| Node | One item in the tree |
| Root | The top-level node (depth 0) |
| Leaf | A node with no children |
| Depth | Distance from root |
| Frontier | The set of children currently being considered |
| Trace | The full sequence of steps for one query |
| Step | One agent iteration (one routing decision) |
| Event | One message on the SSE stream (steps and lifecycle markers both produce events) |
