# Vision

> **Status — design.** This is the why. URL, folders, state, and rollout are in 02–08.

## What the playground is

A single screen with four regions, scoped to one tree:

```
┌────────────┬──────────────────────────────┬──────────────────┬──────────────────┐
│ History    │       Tree canvas            │   Trace          │   Chat           │
│ sidebar    │   (the knowledge tree the    │   (the agent's   │   (the user's    │
│            │    user is chatting with)    │    last reply,   │    conversation  │
│ per-tree   │                              │    expanded)     │    with the      │
│ convs +    │                              │                  │    tree)         │
│ new conv   │                              │                  │                  │
└────────────┴──────────────────────────────┴──────────────────┴──────────────────┘
                              one tree, one conversation, live
```

The user has already authored a tree at `/trees/:treeId`. They click **Run tree**. The playground opens with that tree on the canvas, an empty (or resumed) conversation on the right, and the trace panel waiting for the first agent reply.

That's it. That's the whole product. Everything else in the repo exists to make this screen work.

## What it stops being

Today the playground is a UI shell with hardcoded mock data:

- `mockTree` is imported directly in `TreePanel`
- `allMockConversations` seed `chatStore`
- `allMockRuns` seed `traceStore`
- `useSendMessage` appends a fake assistant reply after 600 ms
- The URL is just `/playground` — no tree, no conversation, no deep link

This is fine as scaffolding. It is not fine as a product. The plan in the rest of this folder is the smallest set of changes that lets the same UI render real data and survive a refresh.

## The per-tree thesis

**A conversation only makes sense inside a tree.** The agent traverses the tree to answer; outside of a tree, there is nothing to traverse. So:

- The URL must carry the tree id (see [02-url-and-entry.md](./02-url-and-entry.md)).
- The conversation history sidebar shows only conversations for the current tree.
- Switching trees is a navigation, not an in-page action — it changes the URL.
- A conversation cannot be "moved" to another tree. If you need that, you fork.

This is one rule with many consequences, and it's the rule that keeps every other design simple. Conversations are per-tree everywhere; we never write code that asks "which trees does this conversation belong to?".

## How a user gets here

```
┌──────────────────────┐    edit tree     ┌──────────────────────┐
│  /  (tree list)      │ ───────────────▶ │  /trees/:treeId      │
│                      │                  │  (authoring surface) │
│   [tree A]  [Run] ───┼─────────┐        │                      │
│   [tree B]  [Run]    │         │        │   [Run tree] ◀───────┼──── second entry
│   [tree C]  [Run]    │         │        │                      │
└──────────────────────┘         │        └──────────────┬───────┘
                                 │                       │
                                 └────────────┬──────────┘
                                              ▼
                          /playground?tree=<treeId>
                                  │
                                  ├─ no ?conv  → server creates + redirects to ?conv=<new>
                                  └─ ?conv=<id> → opens that conversation
```

Two entry points, one destination. The **Run tree** button is the same affordance from both places. The tree list version is for "I want to use a tree I made earlier"; the workspace version is for "I just edited this and want to try it now". Both navigate to the same URL.

The list and the workspace never know what conversation will be opened — that's the playground's job (resume the last one, or create a new one).

## What stays, what changes

| The UI shape | The data behind it |
|---|---|
| Four regions, divider widths, color palette, React Flow canvas, component anatomy — **all stays.** | Mocks go. Tree comes from `GET /trees/:treeId`. Conversations come from `GET /trees/:treeId/conversations`. Messages come from `GET /conversations/:id`. Runs come from `GET /runs/:id`. |
| The Zustand stores for ephemeral UI state — **stay.** | The Zustand stores that seed from mocks — **stop seeding from mocks**. They start empty and get hydrated on mount. |
| The `TreePanel`, `TracePanel`, `ChatPanel`, `ConversationSidebar` components — **stay**, possibly renamed, possibly moved into `src/playground/`. | The hooks they call (`useSendMessage`, the direct `mockTree` import) get rewritten against real APIs. |

The point of this folder is to make those data swaps **mechanical** — every component touches exactly one boundary, and every boundary has a single doc that defines it.

## Non-goals (for the playground specifically)

The playground is **not**:

- **A place to author a tree.** Tree authoring lives at `/trees/:treeId`. The playground reads the tree, never writes it. If the user wants to edit, they navigate to the workspace.
- **A place to manage users / accounts / billing.** Out of scope, ever.
- **A polished consumer chat app.** The trace panel and the tree canvas are first-class; we don't hide them behind a toggle. If a polished consumer surface is needed later, it's a *different* page that reuses the chat panel — not a mode of this one.
- **Multi-tree.** One tree per session. If you want to compare two trees, open two tabs.

## Scaling thesis

The playground grows by adding **modules**, not by adding code to existing files. The folder structure ([03-folder-structure.md](./03-folder-structure.md)) is built around this:

- A new model = one entry in the registry.
- A new region = one folder under `regions/`.
- A new URL param = one line in the URL codec.
- A new event from the agent = one handler in the SSE consumer.
- A new way to enter the playground = a `<Link>` from somewhere else; the URL contract does the rest.

If a feature can't be added by touching exactly one folder, the design is wrong — fix the design, not the feature.

## What "done" looks like for v1

1. User clicks **Run tree** on a tree they authored. They land on `/playground?tree=<id>&conv=<new id>` with the tree rendered on the canvas and an empty conversation visible.
2. They type a message. It POSTs to the backend, persists, and appears in the transcript. (Assistant reply can be a stub until the agent ships.)
3. They refresh. They land back on the same conversation. Messages are intact.
4. They open the sidebar. They see every conversation they've had with this tree, newest first.
5. They open a different conversation. URL changes, transcript changes, trace clears.
6. They copy the URL and paste it in another tab. Same view.

When all six work end-to-end against the database, v1 is done. The agent and the live trace are v1.5 — see [07-agent-wiring.md](./07-agent-wiring.md).
