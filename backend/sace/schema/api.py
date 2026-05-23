from __future__ import annotations

from pydantic import BaseModel, Field

from sace.schema.node import Node


class TreeSummary(BaseModel):
    id: str
    name: str
    description: str = ""
    node_count: int = 0


class TreeListResponse(BaseModel):
    trees: list[TreeSummary]


class NodeDetailResponse(BaseModel):
    node: Node
    breadcrumbs: list[Node]


class QueryRequest(BaseModel):
    tree_id: str
    query: str = Field(..., min_length=1)


class QueryResponse(BaseModel):
    run_id: str
