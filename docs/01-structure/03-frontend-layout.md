# Frontend layout

The frontend is a Vite + React + TypeScript SPA. Code is grouped by **feature**, not by file type — so the three big regions of the playground UI (tree, chat, trace) each own their own folder.

> **Status — experimental.** The tree below is what currently exists. `App.tsx` is a router (three routes), not a single shell. The playground (`/playground`) is mock-data-only — none of the `api/` modules are wired into it yet; the tree CRUD pages do hit the backend through React Query.

```
frontend/
├── index.html
├── package.json                     # @xyflow/react v12, react-router-dom v6,
│                                    # @tanstack/react-query, zustand, react-markdown,
│                                    # d3-hierarchy, tailwind
├── tsconfig.json                    # "@/*": ["src/*"]
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .env.example                     # VITE_API_URL=http://localhost:8000
│
├── public/
│   └── (favicon, etc.)
│
└── src/
    ├── main.tsx                     # bootstraps React, providers (BrowserRouter, QueryClient)
    ├── App.tsx                      # <Routes>: / → TreeListPage, /trees/:id → TreeWorkspacePage,
    │                                #          /playground → PlaygroundPage
    ├── index.css                    # tailwind base + color-scheme: dark
    │
    ├── pages/                       # ← NEW vs. earlier spec
    │   ├── TreeListPage.tsx         # list / create / delete trees (CRUD via React Query)
    │   ├── TreeWorkspacePage.tsx    # outline + node editor + chat placeholder
    │   └── PlaygroundPage.tsx       # the four-region debugger shell
    │
    ├── api/                         # transport — REST + (planned) SSE
    │   ├── client.ts                # fetch wrapper, base URL, error envelope
    │   ├── trees.ts                 # listTrees, getTree, createTree, updateTree, deleteTree
    │   ├── query.ts                 # (planned) postQuery({ tree_id, query }) → { run_id }
    │   └── events.ts                # (planned) subscribeEvents(run_id, onEvent) — wraps EventSource
    │
    ├── types/
    │   ├── generated.ts             # ← auto-generated from Pydantic; do not edit
    │   └── index.ts                 # re-exports + UI-only helpers
    │
    ├── data/                        # ← NEW: mock fixtures
    │   └── mockData.ts              # CS tree + 2 conversations + 5 completed runs
    │
    ├── store/                       # Zustand stores
    │   ├── traceStore.ts            # runs keyed by run_id (seeded from mockData)
    │   ├── chatStore.ts             # conversations, activeConversationId, model (MODELS = …)
    │   └── uiStore.ts               # selectedNodeId, debugTarget, debugMode, selectedStepIdx,
    │                                #   sidebarOpen
    │
    ├── features/
    │   ├── tree/
    │   │   ├── TreePanel.tsx        # the React Flow surface (used by PlaygroundPage)
    │   │   ├── TreeNode.tsx         # custom node renderer (highlight: visited|cursor|step)
    │   │   ├── TreeOutline.tsx      # textual outline (used by TreeWorkspacePage)
    │   │   ├── NodeEditor.tsx       # node form (used by TreeWorkspacePage)
    │   │   ├── treeUtils.ts         # findNode, updateNodeInTree
    │   │   ├── layout.ts            # d3-hierarchy → React Flow positions
    │   │   ├── highlights.ts        # apply current/visited/considered styles  (currently empty / placeholder)
    │   │   └── hooks.ts             # useTree(id) — TanStack Query wrapper
    │   │
    │   ├── chat/
    │   │   ├── ChatPanel.tsx        # used by PlaygroundPage
    │   │   ├── ConversationSidebar.tsx   # ← NEW: brand, model pills, conv list
    │   │   ├── MessageList.tsx      # bubbles + per-message RouteSummary pill
    │   │   ├── MessageInput.tsx     # single-line input (planned: textarea + Cmd+Enter)
    │   │   ├── AgentPlaceholder.tsx # used by TreeWorkspacePage (chat is unimplemented there)
    │   │   └── hooks.ts             # useSendMessage() — currently a 600 ms mock
    │   │
    │   └── trace/
    │       ├── TracePanel.tsx       # message selector + run meta + step cards + final answer
    │       ├── StepCard.tsx         # one routing decision (foldouts: thinking, prompt, raw, metrics)
    │       ├── PromptPreview.tsx    # planned — placeholder for raw-prompt viewer
    │       └── hooks.ts             # (currently empty) — will host useLiveTrace(run_id)
    │
    ├── components/                  # shared dumb components
    │   ├── Panel.tsx
    │   ├── ResizeHandle.tsx
    │   ├── Markdown.tsx
    │   └── Spinner.tsx
    │
    └── lib/
        ├── cn.ts                    # className helper
        ├── time.ts                  # ms / duration formatting
        └── env.ts                   # typed import.meta.env wrapper
```

## Layout shell (`App.tsx`)

Three resizable panels:

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  Tree panel  │   Trace panel (collapsible)   │   Chat panel     │
│              │                               │                  │
│  TreePanel   │   TracePanel                  │   ChatPanel      │
│              │                               │                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

The "middle" of the user's brief becomes **Tree + Trace** stacked horizontally; the trace can be hidden to give the tree more room. See [06-frontend/01-layout.md](../06-frontend/01-layout.md) for the rationale and breakpoints.

## State boundaries

| State | Lives in | Why there |
|---|---|---|
| Tree definition (the data) | TanStack Query cache, keyed by `tree_id` | Server data — caching + refetch |
| Current run id + steps | `traceStore` (Zustand) | Streams in via SSE; ephemeral |
| Chat messages | `chatStore` (Zustand) | Cross-component, simple |
| Panel sizes, selected node | `uiStore` (Zustand) | Pure UI, no server |
| Form input drafts | local `useState` | No reason to lift |

Rule: **server data → TanStack Query. Live stream + UI → Zustand. Form text → useState.** Don't cross the streams.

## Generated types

`frontend/src/types/generated.ts` is produced by `scripts/gen_types.py` (Python). It mirrors `backend/sace/schema/`. Frontend code imports from `@/types`, never from `generated.ts` directly — that gives us an indirection layer in case we want to add UI-only fields.

## Why feature folders, not type folders

We considered the classic `src/{components, hooks, pages, utils}` layout. It loses badly here because the three "regions" (tree / trace / chat) have almost no overlap and we expect to iterate on each independently. Feature folders keep a region's code together — easier to delete, easier to refactor.

Shared code that *is* general (e.g. `Markdown.tsx`, `cn.ts`) lives in `components/` or `lib/`.

## Path alias

`tsconfig.json` sets `"@/*": ["src/*"]`. Use `@/features/tree/...`, never `../../../features/...`.
