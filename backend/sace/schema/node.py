from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Node(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., pattern=r"^[a-z0-9][a-z0-9_.-]*$")
    title: str = Field(..., max_length=80)
    description: str = Field(..., max_length=280)
    detail: str = ""
    children: list[Node] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


Node.model_rebuild()


class Tree(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str = ""
    root: Node
