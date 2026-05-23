from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sace.api.deps import get_event_bus, get_run_registry
from sace.api.routes import events, query, trees
from sace.config import get_settings
from sace.db.seed import seed_from_json_directory
from sace.db.session import get_session_factory, init_db, tree_count
from sace.util.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    settings = get_settings()
    init_db()

    session = get_session_factory()()
    try:
        if tree_count(session) == 0:
            data_dir = Path(settings.data_trees_dir)
            if not data_dir.is_absolute():
                repo_root = Path(__file__).resolve().parents[3]
                data_dir = repo_root / data_dir
            seed_from_json_directory(session, data_dir)
    finally:
        session.close()

    yield


def create_app() -> FastAPI:
    app = FastAPI(title="SACE", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ],
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(trees.router, prefix="/api/v1/trees", tags=["trees"])
    app.include_router(query.router, prefix="/api/v1/query", tags=["query"])
    app.include_router(events.router, prefix="/api/v1/events", tags=["events"])

    @app.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    _ = get_event_bus(), get_run_registry()
    return app
