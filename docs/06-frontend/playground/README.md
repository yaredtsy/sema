# Playground — integration plan

> **Status — design, not built.** The playground UI already exists at `/playground` and runs entirely on mocks (`frontend/src/data/mockData.ts`). This folder is the plan to make it real: wire it to the database, give it a proper URL contract, restructure the code for scale, and prepare it to plug into the agent when the agent lands.

The playground is **the real product surface**. The layout is right — conversation sidebar on the left, tree canvas in the middle, debug/trace on the inner right, chat on the outer right. We don't change that. We change what feeds it.

## The shape, in one line

```
Tree list (existing)              Run tree ▼
   /  ──────────────────────────────────────▶  /playground?tree=<treeId>
                                                │
                                                ▼
                                  ┌──────────────────────────────────────┐
                                  │  Sidebar │   Tree    │ Trace │ Chat  │
                                  │ history  │  canvas   │ panel │ panel │
                                  └──────────────────────────────────────┘
                                                │
                                                │ deep link
                                                ▼
                                  /playground?tree=…&conv=…&msg=…&step=…
```

The user authors a tree at `/trees/:treeId`, hits **Run tree**, and lands in the playground with that tree loaded and a fresh (or last-used) conversation open. Refresh works. Share works. Back-button works.

## How to read these docs

Read in order. Each doc assumes the previous one. Every section is tagged **shipped** / **design** / **future** so you can tell at a glance what's real.

| # | File | What you get |
|---|---|---|
| 01 | [vision.md](./01-vision.md) | What the playground is, what it stops being (mock toy), the per-tree thesis, scope |
| 02 | [url-and-entry.md](./02-url-and-entry.md) | "Run tree" button, `/playground?tree=…&conv=…&msg=…&step=…`, refresh/share/back rules |
| 03 | [folder-structure.md](./03-folder-structure.md) | `frontend/src/playground/` module layout, rules that keep it modular at scale |
| 04 | [state-and-data.md](./04-state-and-data.md) | React Query vs Zustand vs URL state, single sources of truth, four flow diagrams |
| 05 | [model-selection.md](./05-model-selection.md) | Registry, per-conversation lock, per-message override, persistence, adding a model |
| 06 | [chat-history.md](./06-chat-history.md) | Per-tree conversation list, persistence, fork-from, search, retention, export/import |
| 07 | [agent-wiring.md](./07-agent-wiring.md) | POST message → SSE → trace, cancellation, parallel runs, replay — **future, not v1** |
| 08 | [rollout-plan.md](./08-rollout-plan.md) | Phased build order: scope, files, acceptance per phase |

## Relation to the existing `06-frontend/0*.md` docs

The sibling files at `docs/06-frontend/01-layout.md` … `05-tree-overlay-debug.md` describe **what ships today** — the mock-data version of each region. They stay as the per-region reference: anatomy, colors, components, state machines.

This folder describes **what to do next** — the integration plan that turns mocks into real data and a URL into a deep-linkable surface. The two are complementary:

| If you want to… | Read |
|---|---|
| Understand how the tree panel renders today | `../02-tree-visualization.md` |
| Understand how the chat panel renders today | `../03-chat-panel.md` |
| Understand the debug panel | `../04-debug-panel.md` |
| Plan the DB / URL / folder integration | this folder |
| Plan agent wiring | [07-agent-wiring.md](./07-agent-wiring.md) |

## The single design constraint

**A playground session is always scoped to one tree.** The URL is required to carry a `tree=<id>`. Without it there is nothing to traverse. Every other choice — sidebar grouping, model defaults, conversation listing, persistence keys — falls out of this one rule.

If you find yourself writing "what if there's no tree?", you're working on something else (the tree list, an empty state). The playground itself refuses to render without a tree.

## What we explicitly defer

- **The agent.** v1 keeps `useSendMessage` as a placeholder. The chat persists, but the assistant reply can be a server stub until the agent ships. See [07-agent-wiring.md](./07-agent-wiring.md) for the slot.
- **Auth.** Single-user dev tool today. When auth lands, every request gains an `Authorization` header; nothing in this design changes.
- **Multi-tree compare side-by-side.** Reserved; not in v1.
- **Editing past messages.** Append-only. The "fork from here" affordance covers the legitimate use case — see [06-chat-history.md](./06-chat-history.md).
