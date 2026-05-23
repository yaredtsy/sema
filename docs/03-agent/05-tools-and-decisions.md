# Tools and decisions

The agent's "actions" are bounded and small. This page enumerates them and the policies that govern them.

## The two actions

1. **`descend(child_id)`** — move the cursor to the named child.
2. **`stop`** — declare the current cursor sufficient to answer.

That's it. There are no other tools in v1. No web search, no calculator, no SQL. The whole point is that the tree *is* the toolset.

## Why so few

Every additional tool means:
- Another schema branch the LLM has to learn.
- Another failure mode (malformed tool call, wrong argument type).
- Another thing to debug.

A small model handles 2-action selection cleanly. Adding tools is something we earn after the baseline works.

## Tool-call shape (not OpenAI tools)

We do **not** use OpenAI's function-calling API in v1. We use a plain XML output the model fills in. Reasons:

- It works identically across any mini model we might want to swap in.
- It is trivial to log and replay.
- It exposes a strict failure mode (parse error) that we can retry deterministically.

If, after we have a working baseline, function-calling improves routing accuracy, we add it as an ablation in `policies.py`.

## Policies

Centralized in `backend/sace/agent/policies.py`. One dataclass, default-instantiated by `Settings`.

```python
@dataclass(frozen=True)
class TraversalPolicy:
    max_depth: int = 5
    beam_width: int = 1              # 1 = greedy single-path; >1 = beam
    stop_on_leaf: bool = True
    require_confidence: float | None = None   # if set, fall back to stop when below
    retry_on_parse_error: int = 1
    answer_uses_ancestors_detail: bool = False
    show_breadcrumbs_in_prompt: bool = True
    show_sibling_titles_in_prompt: bool = False    # ablation
```

Every field is a knob we expect to flip during the experiment.

## Decision validation

Before we trust a parsed `RoutingDecision`:

```python
def validate(d: RoutingDecision, cursor: Node) -> RoutingDecision:
    if d.kind == "stop":
        return d
    if d.child_id not in {c.id for c in cursor.children}:
        raise InvalidDecision(f"child_id {d.child_id!r} not a child of {cursor.id!r}")
    if policy.require_confidence is not None and (d.confidence or 0) < policy.require_confidence:
        return RoutingDecision(kind="stop", reasoning="below confidence threshold")
    return d
```

`InvalidDecision` triggers exactly one retry with a stronger format reminder. A second failure → forced `stop`.

## Stop conditions, in priority order

1. `decision.kind == "stop"` → `stop_reason = "agent_stop"`.
2. `cursor` is a leaf (`children == []`) → `stop_reason = "leaf"`.
3. `depth >= policy.max_depth` → `stop_reason = "max_depth"`.
4. Two parse errors in a row → `stop_reason = "error"`.

The first that matches wins. We log which one fired.

## Cancellation

A run is cancelled when the SSE consumer disconnects or `POST /api/v1/runs/{id}/cancel` is called. The `RunRegistry` sets a `cancellation_event`; nodes check it between LLM calls. We never interrupt an in-flight LLM call (the cost is sunk; let it finish, then exit).

## Cost shape

For a tree of depth D with branching factor B and beam width K, the number of router LLM calls is `D × K`. The answer call is `1`. With D=5, K=1, that's **6 mini-model calls per query**. At current mini pricing this is a fraction of a cent — the experiment is cheap to run thousands of times.

## What is on the road but not built

| Feature | Why later | Where it would slot in |
|---|---|---|
| Beam search (K > 1) | First make the K=1 path solid | `agent/visit_node.py`, `policies.py` |
| Backtracking | Requires "regret" detection logic | new `agent/regret_node.py` |
| Cross-tree jumps | Needs an "are we in the wrong tree" detector | new state field + router prompt |
| Multi-turn chat | Adds session state | separate doc; out of v1 scope |
| Tool calls (e.g. web search at a leaf) | First confirm tree-only baseline | `agent/leaf_tools/` |

Each of these is one named branch in `policies.py`. The graph stays the same shape until we have evidence that the change is worth it.
