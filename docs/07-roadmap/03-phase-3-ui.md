# Phase 3 — UI

**Goal:** The three-panel app exists; you can type a question and see the tree visualization plus the answer. No live trace animation yet — just final-state rendering.

**Done when:** in the browser, you can submit a query and watch the answer appear in the chat, with the final cursor highlighted in the tree.

## Tasks

### 3.1 FastAPI server
- `backend/sace/api/app.py` — `create_app()` factory with CORS + lifespan that loads the `TreeStore`.
- `backend/sace/api/deps.py` — `get_store`, `get_bus`, `get_chat_model_factory` (FastAPI Depends).
- `backend/sace/api/routes/trees.py` — `GET /trees`, `GET /trees/{id}`, `GET /trees/{id}/nodes/{node_id}`.
- `backend/sace/api/routes/query.py` — `POST /query` that schedules the agent run (via `asyncio.create_task`) and returns `{run_id}`.
- `backend/sace/api/runs.py` — `RunRegistry` with in-flight tracking + cancellation event.

Defer SSE until Phase 4. Phase 3 polls `GET /runs/{run_id}` instead.

### 3.2 Type generation
- `scripts/gen_types.py` — runs `pydantic-to-typescript` or a small custom emitter against `backend/sace/schema/`.
- Output: `frontend/src/types/generated.ts`.
- Add `make types` target.

### 3.3 Frontend scaffold
- `npm create vite@latest frontend -- --template react-ts`
- Tailwind + PostCSS + autoprefixer setup.
- Path alias `@/*` → `src/*`.
- `.env.local` with `VITE_API_URL`.
- Folder layout per [01-structure/03-frontend-layout.md](../01-structure/03-frontend-layout.md).

### 3.4 API client
- `frontend/src/api/client.ts` — fetch wrapper with base URL + error envelope handling.
- `frontend/src/api/trees.ts`, `query.ts`, `runs.ts`.
- TanStack Query setup in `main.tsx`.

### 3.5 Zustand stores
- `traceStore` with the slices for `runId`, `status`, `cursorId`, `visitedIds`, `steps`.
- `chatStore` for messages.
- `uiStore` for `selectedNode`, panel sizes.

### 3.6 Three-panel layout
- `App.tsx` with `react-resizable-panels`.
- Header bar with tree dropdown, model badge, status.

### 3.7 Tree viz
- `TreePanel.tsx` mounted with React Flow.
- `layout.ts` using `d3-hierarchy`.
- `TreeNode.tsx` reading highlight state.
- Click → `uiStore.setSelectedNode`.
- Detail card slide-in showing the clicked node's full content.

### 3.8 Chat panel (polling version)
- `ChatPanel.tsx` with `MessageInput` + `MessageList`.
- On submit: `POST /query`, then poll `GET /runs/{run_id}` every 500ms until `status != "running"`.
- When done, populate `traceStore` from the run's `trace` array; highlight final cursor.

Polling is a temporary stop-gap so we ship the UI without SSE plumbing. Replaced in Phase 4.

### 3.9 Trace panel (static version)
- Renders steps from `traceStore.steps` — but populated only at end of run (since we're polling).
- Step cards with reasoning + foldouts for prompt/output.
- Live trace animation deferred to Phase 4.

### 3.10 Tests
- A smoke Playwright (or Vitest + jsdom for components) that:
  1. Renders the app
  2. Sees the tree load
  3. Submits a query (against a real or stubbed backend)
  4. Sees an answer appear
  
  If Playwright feels heavy, a single happy-path component test is fine for v1.

## Out of scope for Phase 3

- SSE (Phase 4)
- Live tree animation (Phase 4)
- Multi-tree selection UX (one tree shown by default; selector is a stretch goal)
- Settings drawer
- Replay mode

## Risks

- **Type generation drift.** Run `make types` in CI on every backend schema change. If we don't, the front-end will subtly desync.
- **CORS misconfig.** Note for self: dev origins are `http://localhost:5173` and `http://127.0.0.1:5173`. Both, not just one.

## Time estimate

Three to four focused days. The new-Vite-app churn is the slowest part.
