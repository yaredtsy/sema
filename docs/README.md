# SACE — Hierarchical Agent Playground

> An experimental **observability-first** playground for studying how a small LLM, given a **dendrogram-shaped knowledge tree**, can answer queries by *traversing* the tree top-down — and a debugger that lets you watch every step, every prompt, every decision, on **two synchronized views**.

This `docs/` folder is both the **design specification** and the **learning journal** for the project. It is organized top-down — from high-level intent to concrete schemas and step lists.

## The big idea, in one line

A chat with an agent **plus** a debugger that lets you pick any past message and visualize the agent's reasoning on it, either inline (Cursor-style with thinking + tool calls) or overlaid on the knowledge tree itself.

## How to read these docs

Read in order if you are new. Each numbered section assumes the previous one.

| # | Section | What you'll get |
|---|---------|-----------------|
| 00 | [Overview](./00-overview/) | Vision, the core idea, big-picture architecture, tech stack |
| 01 | [Structure](./01-structure/) | The monorepo layout, backend layout, frontend layout |
| 02 | [Data model](./02-data-model/) | `Node`, tree operations, storage, Conversation/Message schema, **SQLAlchemy DB & ORM** |
| 03 | [Agent](./03-agent/) | LangGraph state, the traversal algorithm, step recording, **multi-turn runs** |
| 04 | [Context engineering](./04-context-engineering/) | XML tree formatting, prompt templates, small-model techniques |
| 05 | [API](./05-api/) | REST endpoints, SSE event stream, event schema |
| 06 | [Frontend](./06-frontend/) | Layout, tree viz, **Cursor-style chat**, **dual-view debugger**, message selector |
| 07 | [Roadmap](./07-roadmap/) | Phase-by-phase implementation plan |

The most important docs in this whole folder:

- [03-agent/03-traversal-algorithm.md](./03-agent/03-traversal-algorithm.md) — what the agent actually does
- [06-frontend/04-debug-panel.md](./06-frontend/04-debug-panel.md) — the dual-view debugger (the project's centerpiece)
- [06-frontend/05-tree-overlay-debug.md](./06-frontend/05-tree-overlay-debug.md) — how the tree visualizes a selected message's run

## TL;DR step-by-step plan

A flat list of the work, in order. Each item links to the doc that explains it.

1. **Define the `Node` schema** — see [02-data-model/01-node-schema.md](./02-data-model/01-node-schema.md)
2. **Define the `Conversation` / `Message` schema** — see [02-data-model/04-conversation-schema.md](./02-data-model/04-conversation-schema.md)
3. **Set up the monorepo** — see [01-structure/01-monorepo.md](./01-structure/01-monorepo.md)
4. **Build the Python tree store** with seed data — see [02-data-model/03-storage.md](./02-data-model/03-storage.md)
5. **Write the XML tree serializer** (the prompt format) — see [04-context-engineering/01-xml-tree-format.md](./04-context-engineering/01-xml-tree-format.md)
6. **Define LangGraph state + nodes** — see [03-agent/02-agent-state.md](./03-agent/02-agent-state.md)
7. **Implement the traversal step** (single-level routing) — see [03-agent/03-traversal-algorithm.md](./03-agent/03-traversal-algorithm.md)
8. **Wire each user message to a fresh agent run** — see [03-agent/06-conversation-and-runs.md](./03-agent/06-conversation-and-runs.md)
9. **Add step recording + thinking/tool event emission** — see [03-agent/04-step-recording.md](./03-agent/04-step-recording.md)
10. **Expose REST + SSE endpoints (with conversation_id scoping)** — see [05-api/01-rest-endpoints.md](./05-api/01-rest-endpoints.md) and [05-api/02-sse-streaming.md](./05-api/02-sse-streaming.md)
11. **Scaffold the React app** (three-region layout) — see [06-frontend/01-layout.md](./06-frontend/01-layout.md)
12. **Build the Cursor-style chat panel** (inline thinking + tool calls) — see [06-frontend/03-chat-panel.md](./06-frontend/03-chat-panel.md)
13. **Build the debug panel with the message selector** — see [06-frontend/04-debug-panel.md](./06-frontend/04-debug-panel.md)
14. **Wire the tree-overlay debug view** — see [06-frontend/05-tree-overlay-debug.md](./06-frontend/05-tree-overlay-debug.md)
15. **Iterate on prompts** with a mini OpenAI model — see [04-context-engineering/03-small-model-techniques.md](./04-context-engineering/03-small-model-techniques.md)

The phase grouping is in [07-roadmap/](./07-roadmap/).

## Project name

`sace` — *Small Agent, Context Engineered*. Working title; rename freely.
