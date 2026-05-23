# Node schema

The `Node` is the *only* domain type. Everything else (events, state, traces) is bookkeeping on top.

## Goals

1. **Three text fields with three jobs.** `title` is for routing labels, `description` is for routing decisions, `detail` is for answering.
2. **Cheap to render at any depth.** A routing prompt should never have to read `detail` — only `title` + `description`.
3. **Recursive but flat-friendly.** Each child is a full `Node`. We can also serialize as a flat list with `parent_id` if we need a graph view.

## Pydantic v2 model

```python
# backend/sace/schema/node.py
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class Node(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        ...,
        description="Stable dotted id, e.g. 'cs.languages.python.async'. "
                    "Must be unique within a tree. Used as the routing target.",
        pattern=r"^[a-z0-9][a-z0-9_.-]*$",
    )
    title: str = Field(
        ...,
        max_length=80,
        description="Short label. Shown in viz; included in routing prompt as the choice text.",
    )
    description: str = Field(
        ...,
        max_length=280,
        description="One-line summary. The router LLM uses ONLY title+description to decide whether "
                    "to descend into this node.",
    )
    detail: str = Field(
        default="",
        description="Long-form markdown content. Only consumed when the agent ARRIVES at this node "
                    "to produce a final answer. Can be empty for purely organizational nodes.",
    )
    children: list["Node"] = Field(
        default_factory=list,
        description="Sub-nodes. Order is significant — the renderer preserves it.",
    )
    tags: list[str] = Field(default_factory=list, description="Optional, free-form.")


Node.model_rebuild()


class Tree(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str = ""
    root: Node
```

## Field rules — why three text fields

| Field | Used by | Length budget | Should it be markdown? |
|---|---|---|---|
| `title` | Routing prompt, tree viz | ≤ 80 chars | No — plain text |
| `description` | Routing prompt | ≤ 280 chars (a tweet) | No — single sentence |
| `detail` | Final-answer prompt | unbounded | **Yes** — markdown |

Why three, not one big blob:

- **The routing decision is repeated at every depth.** Including `detail` in the routing prompt would blow up the context fast. Keeping `description` short keeps each routing prompt < 1k tokens even on big trees.
- **The answer step is rare** (once per query, on the final node — or last few nodes). It can afford the long `detail`.
- **The viz needs `title` alone.** Anything more makes the tree unreadable.

The fields are not redundant; they correspond to the three contexts a node is rendered in.

## Validation

- `id` must match `^[a-z0-9][a-z0-9_.-]*$`. This keeps ids URL- and prompt-safe.
- `title` ≤ 80 chars (hard error if longer). Prevents the routing prompt from drifting.
- `description` ≤ 280 chars (hard error). Same reason.
- Within a tree, all `id`s must be unique. Enforced by `TreeStore.load()`, not by `Node` itself (Pydantic can't see siblings).

## Identity & hierarchy

We **do not** store `parent_id` on the node. The tree shape *is* the parent relation. If we need a flat representation, the `TreeStore` will produce it (see [02-tree-operations.md](./02-tree-operations.md)).

Dotted `id`s are a hint, not enforcement. `cs.languages.python` is not required to be a child of `cs.languages`. We *should* keep them aligned because debugging is easier, but the agent never parses the dots.

## Example node (JSON)

```json
{
  "id": "cs.languages.python.async",
  "title": "Async in Python",
  "description": "asyncio event loop, coroutines, async/await syntax, common pitfalls vs threads.",
  "detail": "# Async Python\n\nPython's `asyncio` is a cooperative concurrency model...",
  "children": [
    {
      "id": "cs.languages.python.async.event-loop",
      "title": "Event loop",
      "description": "How the asyncio loop schedules coroutines and integrates with selectors.",
      "detail": "...",
      "children": []
    }
  ],
  "tags": ["python", "concurrency"]
}
```

## Common authoring mistakes (write tests for these)

- `description` rewrites `title` ("Async in Python — covers async in Python"). Useless to the router. The description should add information that distinguishes this node from its siblings.
- `description` is generic ("Important topic in CS"). The router can't tell siblings apart. **Bad descriptions are the #1 failure mode of the whole system** — see [04-context-engineering/02-prompt-templates.md](../04-context-engineering/02-prompt-templates.md).
- Children duplicate the parent's coverage. The dendrogram should *refine*; siblings should be *orthogonal*.
- Empty `detail` on leaf nodes. Internal nodes can have empty detail (they're organizational), but leaves should answer something.

## Extension points (later, not now)

- `links: list[str]` — outbound references to other nodes (when we want a DAG, not just a tree).
- `embedding: list[float]` — optional cached embedding for hybrid retrieval ablation.
- `version: int` — for editable trees.

All three are deliberately absent in v1.
