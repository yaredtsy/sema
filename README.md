# SACE

Structured knowledge trees + small-model agent traversal.

## Quick start

```bash
# Backend
uv sync --group dev
make dev-backend   # http://localhost:8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Layout

- `backend/sace/` — Python package (FastAPI, LangGraph, schemas)
- `frontend/` — React + Vite SPA
- `data/trees/` — example knowledge trees (JSON)
- `docs/` — design and architecture

## Make targets

| Target | Description |
|--------|-------------|
| `make dev-backend` | Uvicorn with reload |
| `make dev-frontend` | Vite dev server |
| `make test` | pytest |
| `make seed` | Load trees from `data/trees/` |
| `make types` | Regenerate frontend types stub |
