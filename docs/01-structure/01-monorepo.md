# Monorepo layout

One repo, two apps, shared docs and data. Flat enough to navigate by `ls`, deep enough to keep concerns apart.

## Top-level

```
sace/
├── backend/                  # Python: FastAPI + LangGraph
├── frontend/                 # React + Vite + TypeScript
├── data/                     # Source-of-truth trees (JSON)
│   ├── trees/
│   │   ├── example-cs.json
│   │   └── example-cooking.json
│   └── README.md
├── docs/                     # You are here
├── scripts/                  # One-off helpers (seed, export, convert)
│   ├── seed_tree.py
│   └── export_trace.py
├── .python-version           # uv pin
├── pyproject.toml            # backend (the Python project)
├── uv.lock
├── package.json              # workspace root (optional, see below)
├── Makefile                  # dev shortcuts
├── README.md                 # project landing
└── .gitignore
```

## Why this shape

- **No nested `apps/` or `packages/`.** With only two apps, the extra layer is noise.
- **Backend uses the root `pyproject.toml`.** The project is already structured that way (`name = "sace"`). We keep that.
- **Frontend is a standalone npm project.** No workspace needed; we can add `pnpm-workspace.yaml` later if we extract a shared types package.
- **`data/` is at the root.** Trees are an input to both the backend (at runtime) and the docs (as examples), so they don't live inside either app.
- **`scripts/` is at the root** because some scripts touch both apps (e.g. generating TypeScript types from the Pydantic schema).

## Backend tree

See [02-backend-layout.md](./02-backend-layout.md). At a glance:

```
backend/
├── sace/
│   ├── __init__.py
│   ├── api/                  # FastAPI app, routes, SSE
│   ├── agent/                # LangGraph graph, nodes, state
│   ├── prompts/              # Prompt templates, XML rendering
│   ├── schema/               # Pydantic models (Node, Event, ...)
│   ├── store/                # TreeStore, JSON loader
│   ├── llm/                  # OpenAI mini-only ChatModel factory
│   └── config.py
├── tests/
└── conftest.py
```

## Frontend tree

See [03-frontend-layout.md](./03-frontend-layout.md). At a glance:

```
frontend/
├── src/
│   ├── components/
│   ├── features/
│   │   ├── tree/             # React Flow tree viz
│   │   ├── chat/             # Chat panel
│   │   └── trace/            # Live trace overlay
│   ├── api/                  # REST + SSE clients
│   ├── store/                # Zustand store
│   ├── types/                # Shared types (generated)
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Shared types — single source of truth

The `Node` and event shapes are defined in **Python (Pydantic v2)**. We generate the TypeScript with [`datamodel-code-generator`](https://github.com/koxudaxi/datamodel-code-generator) or the simpler `pydantic-to-typescript`. The script lives in `scripts/gen_types.py` and writes to `frontend/src/types/generated.ts`.

Rule: **never hand-edit `generated.ts`**. Run the script as part of `make types`.

## Makefile targets

```makefile
dev          # run backend + frontend concurrently
dev-backend  # uvicorn with reload
dev-frontend # vite dev
test         # pytest + vitest
seed         # load data/trees/*.json into the store
types        # regenerate frontend types from Pydantic schemas
lint         # ruff + eslint + prettier
fmt          # ruff format + prettier --write
```

`make` is optional; `just` works equally well. Either way, the user-facing surface is *one verb per task*.

## Things that intentionally do not exist (yet)

- No `apps/` / `packages/` split.
- No `libs/` for shared Python utilities — they live inside `backend/sace/`.
- No `examples/` folder — example trees go in `data/trees/`.
- No `infra/` — there is no deploy target yet.

When any of these becomes painful, we add it. Not before.
