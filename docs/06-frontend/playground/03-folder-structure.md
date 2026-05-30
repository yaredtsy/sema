# Folder structure

> **Status — design.** Today the playground is spread across `src/pages/PlaygroundPage.tsx` + `src/features/{tree,trace,chat}/` + `src/store/` + `src/data/mockData.ts`. The target is one module at `src/playground/` using the **feature-folder pattern**: every feature is a small folder with predictable `components/ · hooks/ · lib/` subfolders, plus top-level `common/`, `hooks/`, `lib/`, `stores/`, `mocks/` for cross-feature concerns. The migration is mechanical and stepwise — see [08-rollout-plan.md](./08-rollout-plan.md).

The folder is the contract. Anyone who has read a React codebase should be able to navigate this in 30 seconds — that's the bar.

## Target layout

```
frontend/src/playground/
│
├── index.ts                          # public exports (PlaygroundPage)
├── PlaygroundPage.tsx                # route component — pure glue, < 80 lines
│
├── features/                         # one folder per feature
│   │
│   ├── tree-canvas/                  # middle: the React Flow knowledge tree
│   │   ├── components/
│   │   │   ├── TreeCanvas.tsx
│   │   │   ├── TreeNode.tsx
│   │   │   └── Legend.tsx
│   │   ├── hooks/
│   │   │   ├── useTreeLayout.ts
│   │   │   └── useNodeHighlights.ts
│   │   ├── lib/
│   │   │   ├── layout.ts             # d3-hierarchy → React Flow positions
│   │   │   └── highlights.ts         # visited / cursor / step style rules
│   │   ├── types.ts
│   │   └── index.ts                  # exports { TreeCanvas }
│   │
│   ├── chat/                         # outer right: transcript + composer
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── Composer.tsx
│   │   │   ├── ModelPicker.tsx       # rendered inside Composer
│   │   │   └── ShowReasoningLink.tsx # per-message link → playground in debug mode
│   │   ├── hooks/
│   │   │   ├── useMessages.ts        # React Query: GET /conversations/:id
│   │   │   ├── useSendMessage.ts     # mutation + optimistic insert
│   │   │   └── useComposerDraft.ts   # localStorage-backed draft per conv
│   │   ├── lib/
│   │   │   └── formatMessage.ts
│   │   ├── types.ts
│   │   └── index.ts                  # exports { ChatPanel }
│   │
│   ├── history/                      # left: per-tree conversation list
│   │   ├── components/
│   │   │   ├── HistorySidebar.tsx
│   │   │   ├── ConversationItem.tsx
│   │   │   ├── NewConversationButton.tsx
│   │   │   └── SearchInput.tsx
│   │   ├── hooks/
│   │   │   ├── useConversations.ts          # React Query: GET /trees/:id/conversations
│   │   │   ├── useCreateConversation.ts     # mutation
│   │   │   └── useConversationFilter.ts     # local search/sort
│   │   ├── lib/
│   │   │   └── groupByDate.ts
│   │   ├── types.ts
│   │   └── index.ts                  # exports { HistorySidebar }
│   │
│   ├── trace/                        # inner right: debug / step cards / live run
│   │   ├── components/
│   │   │   ├── TracePanel.tsx
│   │   │   ├── StepCard.tsx
│   │   │   ├── PromptPreview.tsx
│   │   │   └── AnswerSection.tsx
│   │   ├── hooks/
│   │   │   ├── useRun.ts             # GET /runs/:id (lazy, cached)
│   │   │   └── useLiveTrace.ts       # subscribes to runs store
│   │   ├── lib/
│   │   │   └── reduceEvents.ts       # SSE event reducer
│   │   ├── types.ts
│   │   └── index.ts                  # exports { TracePanel }
│   │
│   └── url-state/                    # URL ↔ playground state
│       ├── hooks/
│       │   ├── usePlaygroundParams.ts
│       │   └── useSyncUrl.ts
│       ├── lib/
│       │   └── codec.ts              # parsePlaygroundUrl / serializePlaygroundUrl (pure)
│       ├── types.ts                  # PlaygroundParams
│       └── index.ts
│
├── common/                           # cross-feature components
│   ├── PlaygroundShell.tsx           # the four-region layout container
│   ├── DebugBanner.tsx
│   ├── DemoBanner.tsx
│   ├── EmptyState.tsx                # "pick a tree" when ?tree is missing
│   └── index.ts
│
├── hooks/                            # cross-feature hooks
│   ├── usePlaygroundTree.ts          # GET /trees/:id — used by canvas + sidebar header
│   ├── useDebugTarget.ts             # uiStore.debugTarget ⇄ URL ?msg
│   └── index.ts
│
├── lib/                              # cross-feature pure utilities (no React)
│   ├── apiClient.ts                  # re-exports src/api/client
│   ├── eventSource.ts                # SSE wrapper: subscribe / unsubscribe / reconnect
│   ├── queryKeys.ts                  # React Query key factories — single source
│   ├── ids.ts                        # optimistic id minting
│   └── index.ts
│
├── stores/                           # Zustand stores scoped to the playground
│   ├── useUiStore.ts                 # debugTarget, selectedStepIdx, selectedNodeId, sidebarOpen, embed
│   ├── useChatStore.ts               # optimistic inserts, send queue, composer drafts
│   ├── useRunsStore.ts               # live SSE-backed runs by run_id
│   └── index.ts
│
└── mocks/                            # demo-mode fixtures (?demo=1)
    ├── tree.ts
    ├── conversations.ts
    ├── runs.ts
    └── index.ts
```

That's the whole module. Five features under `features/`, four cross-cutting buckets, one mock folder. Every file lives somewhere obvious.

## The pattern, in one sentence per folder

| Folder | Holds | Don't put here |
|---|---|---|
| `features/<x>/components/` | React components used **only** inside this feature | Components used by another feature (→ `common/`) |
| `features/<x>/hooks/` | Hooks used **only** inside this feature | Hooks used by another feature (→ top-level `hooks/`) |
| `features/<x>/lib/` | Pure TS used **only** inside this feature | Anything that imports React (it's not pure) |
| `features/<x>/types.ts` | Types used by 2+ files in this feature | Types used outside the feature (→ `lib/` or top-level `types.ts`) |
| `features/<x>/index.ts` | Public components/hooks of the feature | The internals — keep them internal |
| `common/` | Components used by 2+ features | One-off components (keep them in the feature) |
| `hooks/` | Hooks used by 2+ features | Feature-specific hooks |
| `lib/` | Pure utilities used by 2+ features | React, JSX, anything stateful |
| `stores/` | Zustand stores | React Query hooks (those live in feature `hooks/`) |
| `mocks/` | Demo-mode fixtures | Test fixtures (those colocate with tests) |

If you can answer "is this used by one feature or more than one?" you can place the file.

## Six rules that keep it modular at scale

Short on purpose. If a PR breaks one, the diff is wrong.

### 1. Features never import from each other

`features/chat/` cannot import from `features/history/`. Cross-feature needs go through `stores/`, `hooks/` (top-level), or props passed by `PlaygroundShell`.

> Why: features are composed, not chained. Forbidding direct imports keeps that property enforceable. If two features need the same component, it belongs in `common/` — or it's actually two components that happen to look alike.

### 2. `lib/` files never import React

`lib/` is for pure functions: codecs, reducers, formatters, key factories. A lint rule (`no-react-in-lib`) keeps this honest.

> Why: pure functions are unit-testable without React Testing Library. They run in Node, they're fast, they don't break. The minute `lib/` starts importing React you've lost that property.

### 3. The URL codec is pure and lives in one file

`features/url-state/lib/codec.ts` exports `parsePlaygroundUrl` and `serializePlaygroundUrl`. They take `search: string`, return / accept `PlaygroundParams`. No `window`, no React, no stores.

> Why: the URL contract grows fastest. A pure function is impossible to misuse from a component and trivial to test exhaustively.

### 4. State is split by lifetime, not by feature

`stores/` has three Zustand stores, named by **how long the state lives**:

- `useUiStore` — survives across mounts, dies on tab close.
- `useChatStore` — optimistic / in-flight only; the server is the source of truth for committed messages.
- `useRunsStore` — live SSE-backed runs; completed runs live in React Query.

> Why: lifetime is the axis that causes bugs. Splitting by feature drifts into duplicating server data into client memory. Lifetime forces you to ask "who owns this?".

### 5. Only feature `hooks/` and top-level `hooks/` touch React Query

Components don't call `useQuery` directly. They consume a feature hook (`useMessages`, `useConversations`, `useRun`) that wraps it. The wrapper file is the only one that knows the query key, retry policy, and error shape.

> Why: when we add OpenAPI codegen, prefetching, or a cache-warming strategy, we want to edit one place per query — not every component that uses it.

### 6. The page is glue, not logic

`PlaygroundPage.tsx` is < 80 lines. It calls `usePlaygroundParams`, decides between `<EmptyState />`, `<DemoBanner />`, or `<PlaygroundShell />`, and stops. No `useEffect` longer than three lines. No business logic.

> Why: page files rot fastest because they're where ad-hoc orchestration lands. Capping forces orchestration into a feature hook or a `common/` component.

## Where things go — quick rules

| Question | Answer |
|---|---|
| "Where do I add a new URL query param?" | `features/url-state/lib/codec.ts` + one consumer hook in the affected feature |
| "Where do I add a new model?" | `features/chat/lib/modelRegistry.ts` (see [05-model-selection.md](./05-model-selection.md)) |
| "Where do I add a new SSE event type?" | `lib/eventSource.ts` dispatch + handler in `stores/useRunsStore.ts` |
| "Where do I add a one-off helper?" | First, count uses. 1: inline. 2+ in one feature: `features/<x>/lib/`. 2+ across features: top-level `lib/`. |
| "Where do I put a test?" | Next to the file. `TreeCanvas.test.tsx` next to `TreeCanvas.tsx`. |
| "Where do I add a new region (5th panel)?" | New folder under `features/`. Add it to `PlaygroundShell`. Update [04-state-and-data.md](./04-state-and-data.md) per-region table. |
| "Where do I add a new shared dumb component (e.g., `Tooltip`)?" | Already exists in the wider app? `frontend/src/components/`. Playground-only? `playground/common/`. |
| "Where do I add a new global UI flag?" | `stores/useUiStore.ts`. Consider whether it belongs in the URL first. |

## Public surface

```ts
// frontend/src/playground/index.ts
export { PlaygroundPage } from "./PlaygroundPage";
```

Nothing else escapes. The router imports `PlaygroundPage`. External code does not reach into `features/`, `stores/`, `data/`, etc.

```ts
// frontend/src/playground/features/chat/index.ts
export { ChatPanel } from "./components/ChatPanel";
```

A feature's `index.ts` exposes only what `PlaygroundShell` needs to render the feature. Internals stay internal.

## Naming conventions

- **Folders:** `kebab-case` (`tree-canvas`, `url-state`). Lowercase, hyphens, no plurals on feature names.
- **Components:** `PascalCase.tsx`. Named exports preferred (`export function ChatPanel(){}`).
- **Hooks:** `useThing.ts`, named export `useThing`. One hook per file.
- **Stores:** `useXxxStore.ts`, named export `useXxxStore`.
- **Pure modules:** `lowerCamel.ts` (`layout.ts`, `highlights.ts`, `codec.ts`, `formatMessage.ts`).
- **Tests:** colocated, `Thing.test.tsx` / `thing.test.ts`.

## How today's files map onto the new layout

This is the *destination*, not a step-by-step. Migration order is in [08-rollout-plan.md](./08-rollout-plan.md).

| Today | Tomorrow |
|---|---|
| `src/pages/PlaygroundPage.tsx` | `src/playground/PlaygroundPage.tsx` + `src/playground/common/PlaygroundShell.tsx` |
| `src/features/chat/ChatPanel.tsx` | `src/playground/features/chat/components/ChatPanel.tsx` |
| `src/features/chat/ConversationSidebar.tsx` | `src/playground/features/history/components/HistorySidebar.tsx` |
| `src/features/chat/MessageInput.tsx` | `src/playground/features/chat/components/Composer.tsx` |
| `src/features/chat/MessageList.tsx` | `src/playground/features/chat/components/MessageList.tsx` |
| `src/features/chat/AgentPlaceholder.tsx` | stays under `src/features/chat/` — only used by `/trees/:treeId` |
| `src/features/chat/hooks.ts` (`useSendMessage`) | `src/playground/features/chat/hooks/useSendMessage.ts` (real version) |
| `src/features/tree/TreePanel.tsx` | `src/playground/features/tree-canvas/components/TreeCanvas.tsx` |
| `src/features/tree/TreeNode.tsx` | `src/playground/features/tree-canvas/components/TreeNode.tsx` |
| `src/features/tree/layout.ts`, `highlights.ts` | `src/playground/features/tree-canvas/lib/` |
| `src/features/tree/TreeOutline.tsx`, `NodeEditor.tsx`, `treeUtils.ts`, `hooks.ts` | stay under `src/features/tree/` — they belong to `/trees/:treeId` authoring |
| `src/features/trace/*` | `src/playground/features/trace/components/` + `lib/` + `hooks/` |
| `src/store/uiStore.ts` | `src/playground/stores/useUiStore.ts` |
| `src/store/chatStore.ts` | `src/playground/stores/useChatStore.ts` (slimmed — server data moves to React Query in `features/chat/hooks/useMessages.ts`) |
| `src/store/traceStore.ts` | `src/playground/stores/useRunsStore.ts` (live only) + React Query cache for completed |
| `src/api/trees.ts`, `query.ts`, `events.ts`, `client.ts` | stay under `src/api/` (shared transport). `src/playground/lib/` re-exports the bits the playground uses |
| `src/data/mockData.ts` | `src/playground/mocks/{tree,conversations,runs}.ts` |

Two things become **explicit by location**:

1. The authoring surface (`/trees/:treeId`) keeps `src/features/tree/`. It is not part of the playground.
2. The shared API client stays in `src/api/`. The playground wraps it; it doesn't own it.

## Anti-patterns we are buying our way out of

- **Big shared stores** (`useAppStore`). Split by lifetime instead — three small stores in `stores/`.
- **`utils/` folders.** They become the junk drawer. Use `lib/` (top-level or per-feature), and only put **pure** code there.
- **Top-level `hooks/` that holds everything.** Hooks live with the feature they serve. Top-level `hooks/` is for the rare 2+ feature consumer.
- **Re-exporting deeply.** `index.ts` per folder is fine for that folder's public surface. Don't re-export across two levels.
- **Folder named `services/`.** We don't have it. `lib/` covers pure transport helpers; feature `hooks/` covers React-aware data calls. Adding `services/` would just be a third synonym for one of those.

## A note on package extraction

There's no plan to extract `src/playground/` into a separate npm package. The folder is the boundary. If we ever wanted to publish it (we won't), the structure is already correct — `index.ts` is the public surface, `mocks/` is dev-only, `stores/` and feature internals are private. Treat that as a happy accident, not a target.
