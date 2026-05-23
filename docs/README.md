# SACE — Hierarchical Agent Playground

> An experimental playground for studying how a small LLM, given a **dendrogram-shaped knowledge tree**, can answer queries by *traversing* the tree top-down instead of doing a flat semantic search.

This `docs/` folder is both the **design specification** and the **learning journal** for the project. It is organized top-down — from high-level intent to concrete schemas and step lists.

## How to read these docs

Read in order if you are new. Each numbered section assumes the previous one.

| # | Section | What you'll get |
|---|---------|-----------------|
| 00 | [Overview](./00-overview/) | Vision, the core idea, big-picture architecture, tech stack |
| 01 | [Structure](./01-structure/) | The monorepo layout, backend layout, frontend layout |
| 02 | [Data model](./02-data-model/) | The `Node` schema, tree operations, storage |
| 03 | [Agent](./03-agent/) | LangGraph state, the traversal algorithm, step recording |
| 04 | [Context engineering](./04-context-engineering/) | XML tree formatting, prompt templates, small-model techniques |
| 05 | [API](./05-api/) | REST endpoints, SSE event stream, event schema |
| 06 | [Frontend](./06-frontend/) | UI layout, tree viz, chat panel, live agent trace |
| 07 | [Roadmap](./07-roadmap/) | Phase-by-phase implementation plan |

The single most important doc is [03-agent/03-traversal-algorithm.md](./03-agent/03-traversal-algorithm.md) — it is the project's reason to exist. Read [00-overview/02-core-concepts.md](./00-overview/02-core-concepts.md) first to understand the vocabulary.

## TL;DR step-by-step plan

A flat list of the work, in order. Each item links to the doc that explains it.

1. **Define the `Node` schema** — see [02-data-model/01-node-schema.md](./02-data-model/01-node-schema.md)
2. **Set up the monorepo** (`backend/` + `frontend/` + `docs/`) — see [01-structure/01-monorepo.md](./01-structure/01-monorepo.md)
3. **Build a Python tree store** with seed data — see [02-data-model/03-storage.md](./02-data-model/03-storage.md)
4. **Write the XML tree serializer** (the prompt format) — see [04-context-engineering/01-xml-tree-format.md](./04-context-engineering/01-xml-tree-format.md)
5. **Define LangGraph state + nodes** — see [03-agent/02-agent-state.md](./03-agent/02-agent-state.md)
6. **Implement the traversal step** (single-level routing) — see [03-agent/03-traversal-algorithm.md](./03-agent/03-traversal-algorithm.md)
7. **Add step recording / event emission** — see [03-agent/04-step-recording.md](./03-agent/04-step-recording.md)
8. **Expose REST + SSE endpoints** — see [05-api/01-rest-endpoints.md](./05-api/01-rest-endpoints.md) and [05-api/02-sse-streaming.md](./05-api/02-sse-streaming.md)
9. **Scaffold the React app** (three-panel layout) — see [06-frontend/01-layout.md](./06-frontend/01-layout.md)
10. **Wire the tree viz to the SSE stream** — see [06-frontend/04-live-trace.md](./06-frontend/04-live-trace.md)
11. **Build the chat panel** — see [06-frontend/03-chat-panel.md](./06-frontend/03-chat-panel.md)
12. **Iterate on prompts** with a small model and compare against a larger one — see [04-context-engineering/03-small-model-techniques.md](./04-context-engineering/03-small-model-techniques.md)

The phase grouping of these 12 steps is in [07-roadmap/](./07-roadmap/).

## Project name

`sace` — *Small Agent, Context Engineered*. Working title; rename freely.
