from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from sace.api.deps import get_tree_store
from sace.schema.api import NodeDetailResponse, TreeListResponse
from sace.schema.node import Tree
from sace.store.tree_store import TreeNotFoundError, TreeStore

router = APIRouter()


@router.get("", response_model=TreeListResponse)
def list_trees(store: TreeStore = Depends(get_tree_store)) -> TreeListResponse:
    return TreeListResponse(trees=store.list_summaries())


@router.post("", response_model=Tree, status_code=status.HTTP_201_CREATED)
def create_tree(tree: Tree, store: TreeStore = Depends(get_tree_store)) -> Tree:
    try:
        return store.create(tree)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{tree_id}", response_model=Tree)
def get_tree(tree_id: str, store: TreeStore = Depends(get_tree_store)) -> Tree:
    tree = store.get(tree_id)
    if tree is None:
        raise HTTPException(status_code=404, detail=f"Tree {tree_id!r} not found")
    return tree


@router.put("/{tree_id}", response_model=Tree)
def update_tree(
    tree_id: str,
    tree: Tree,
    store: TreeStore = Depends(get_tree_store),
) -> Tree:
    if tree.id != tree_id:
        raise HTTPException(status_code=400, detail="Tree id in body must match URL")
    try:
        return store.update(tree_id, tree)
    except TreeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{tree_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tree(tree_id: str, store: TreeStore = Depends(get_tree_store)) -> None:
    try:
        store.delete(tree_id)
    except TreeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{tree_id}/nodes/{node_id}", response_model=NodeDetailResponse)
def get_node(
    tree_id: str,
    node_id: str,
    store: TreeStore = Depends(get_tree_store),
) -> NodeDetailResponse:
    node = store.find_node(tree_id, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Node {node_id!r} not found")
    return NodeDetailResponse(node=node, breadcrumbs=store.breadcrumbs(tree_id, node_id))
