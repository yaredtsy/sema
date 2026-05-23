# Frontend layout

The frontend is a Vite + React + TypeScript SPA. Code is grouped by **feature**, not by file type — so the three big regions of the UI (tree, chat, trace) each own their own folder.

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .env.local                       # VITE_API_URL=http://localhost:8000
│
├── public/
│   └── favicon.svg
│
└── src/
    ├── main.tsx                     # bootstraps React, providers
    ├── App.tsx                      # the three-panel shell
    ├── index.css                    # tailwind base
    │
    ├── api/                         # transport — REST + SSE
    │   ├── client.ts                # fetch wrapper, base URL, error envelope
    │   ├── trees.ts                 # getTree(id), listTrees()
    │   ├── query.ts                 # postQuery({ tree_id, query }) → { run_id }
    │   └── events.ts                # subscribeEvents(run_id, onEvent) — wraps EventSource
    │
    ├── types/
    │   ├── generated.ts             # ← auto-generated from Pydantic; do not edit
    │   └── index.ts                 # re-exports + UI-only helpers
    │
    ├── store/                       # Zustand store(s)
    │   ├── traceStore.ts            # current run, steps, cursor, breadcrumbs
    │   ├── chatStore.ts             # message history
    │   └── uiStore.ts               # panel sizes, selected node
    │
    ├── features/
    │   ├── tree/
    │   │   ├── TreePanel.tsx        # the React Flow surface
    │   │   ├── TreeNode.tsx         # custom node renderer
    │   │   ├── layout.ts            # tidy-tree / dagre layout helper
    │   │   ├── highlights.ts        # apply current/visited/considered styles
    │   │   └── hooks.ts             # useTree(), useNodeFocus()
    │   │
    │   ├── chat/
    │   │   ├── ChatPanel.tsx
    │   │   ├── MessageList.tsx
    │   │   ├── MessageInput.tsx
    │   │   └── hooks.ts             # useSendQuery()
    │   │
    │   └── trace/
    │       ├── TracePanel.tsx       # collapsible side panel listing steps
    │       ├── StepCard.tsx         # one routing decision card
    │       ├── PromptPreview.tsx    # toggle to see raw prompt
    │       └── hooks.ts             # useLiveTrace(run_id)
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
