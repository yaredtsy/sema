from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from sace.api.deps import get_run_registry, get_tree_store
from sace.api.runs import RunRegistry
from sace.schema.api import QueryRequest, QueryResponse
from sace.store.tree_store import TreeStore
from sace.util.ids import new_run_id

router = APIRouter()


@router.post("", response_model=QueryResponse)
def post_query(
    body: QueryRequest,
    store: TreeStore = Depends(get_tree_store),
    runs: RunRegistry = Depends(get_run_registry),
) -> QueryResponse:
    if store.get(body.tree_id) is None:
        raise HTTPException(status_code=404, detail=f"Tree {body.tree_id!r} not found")
    run_id = new_run_id()
    runs.register(run_id, {"tree_id": body.tree_id, "query": body.query})
    return QueryResponse(run_id=run_id)
