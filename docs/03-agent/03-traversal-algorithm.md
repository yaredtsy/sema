# Traversal algorithm

This is **the** doc. Everything else is plumbing. Read [02-core-concepts.md](../00-overview/02-core-concepts.md) first if you haven't.

## The algorithm in one paragraph

> Starting at the root, ask the LLM: *"Given the user's query and these children (title + description each), which one should we descend into — or is the current node specific enough to answer?"* If it picks a child, set the cursor to that child and repeat. If it says stop, or we hit a leaf, or we hit max depth, hand the cursor's `detail` plus the breadcrumb trail to the LLM and produce the final answer.

That's it. The rest is operationalizing it.

## Pseudocode

```python
async def run(query: str, tree: Tree, max_depth: int = 5) -> str:
    cursor = tree.root
    trace: list[TraceStep] = []

    for depth in range(max_depth):
        prompt = render_router_prompt(
            query=query,
            cursor=cursor,
            children=cursor.children,
            breadcrumbs=breadcrumbs_to(cursor),
            previous_decisions=trace,  # short summary, not full prompts
        )
        raw = await llm.acomplete(prompt)
        decision = parse_router_output(raw, valid_child_ids={c.id for c in cursor.children})

        trace.append(TraceStep(node_id=cursor.id, prompt=prompt, raw_output=raw, decision=decision, ...))
        emit("step", trace[-1])

        if decision.kind == "stop" or not cursor.children:
            break

        cursor = find_child(cursor, decision.child_id)

    answer = await compose_answer(query, cursor, trace)
    emit("final", answer)
    return answer
```

## Detailed step-by-step

### Step 1: Render the router prompt

Inputs to the prompt:

- The user's `query` verbatim.
- A **breadcrumb summary** — the chain of `(title, one-sentence reason we descended)` from root to cursor. Tells the LLM where it already is.
- The cursor's `title` + `description` (so the LLM can decide "we're already specific enough, stop").
- The children of the cursor as a **numbered list**, each with `id`, `title`, `description`.
- An XML-formatted output instruction.

The full template is in [04-context-engineering/02-prompt-templates.md](../04-context-engineering/02-prompt-templates.md). Crucially:

- We do **not** include `detail` for any node in a routing prompt.
- We do **not** include siblings of ancestors (no peripheral vision) in v1. That's an ablation later.

### Step 2: Call the LLM

One call. Mini-tier OpenAI model. Temperature low (0.1–0.3). We always include a `response_format` or an XML schema instruction so the output is parseable.

### Step 3: Parse the decision

The expected output (see XML format doc) looks like:

```xml
<decision>
  <reasoning>The user asks about async patterns; child python.async matches.</reasoning>
  <action>descend</action>
  <target>cs.languages.python.async</target>
  <confidence>0.85</confidence>
</decision>
```

or

```xml
<decision>
  <reasoning>Current node already covers the query topic at the right level.</reasoning>
  <action>stop</action>
</decision>
```

Parser:
1. Find the `<decision>` block (regex on the outermost tag).
2. Extract `<action>`, `<target>`, `<reasoning>`, `<confidence>`.
3. If `action=descend`, `target` must be in the set of valid child ids → otherwise **one retry** with a stronger format reminder. If it still fails, treat as `stop`.

We never trust the LLM's free-text `id` without validation.

### Step 4: Update the cursor

`cursor ← cursor.children[target]`. Push the old cursor into `visited_ids`. Increment `depth`.

### Step 5: Stop conditions

Stop if **any** of:

- `decision.kind == "stop"`.
- `cursor` has no children (a leaf).
- `depth >= max_depth`.
- A non-recoverable error in `router` or `parse`.

### Step 6: Compose the answer

Now and only now do we read `detail`. Inputs to the answer prompt:

- The user's `query`.
- The cursor's `title`, `description`, **`detail`**.
- The breadcrumb summary (compact, just `title`s).
- Optionally, the last 1–2 ancestors' `detail` if `detail`-fusion ablation is enabled.

One LLM call. Output is plain markdown.

## Variants (ablations to try, not v1)

Document each in `docs/experiments/` once we run them.

| Variant | What it does | Why try it |
|---|---|---|
| **Beam-2** | At each level keep top-2 children, recurse both | When sibling distinction is hard |
| **Look-ahead** | Include grandchildren titles in routing prompt | More expensive, may improve routing |
| **Backtrack** | If `detail` is irrelevant after arrival, return to parent | Recovery from bad routing |
| **Detail fusion** | Combine `detail` from last K ancestors in the answer | When the answer needs multi-level synthesis |
| **No breadcrumbs** | Drop the breadcrumb summary | Test whether the model needs the trail |
| **JSON output** | Replace XML output with JSON | Compare parser robustness |

Each is one A/B switch in `agent/policies.py`. No code branching outside that module.

## Failure modes to watch for

1. **Router picks the wrong sibling.** Usually a description-quality problem (see [02-data-model/01-node-schema.md](../02-data-model/01-node-schema.md)). Fix the tree, not the prompt.
2. **Router never stops.** Descends to a leaf even when an internal node already answers. Fix: stronger stop framing in the prompt + a few-shot example of stopping early.
3. **Router invents a child id.** Mini models do this. Always validate against the actual set; retry with a constrained reminder.
4. **Cursor lands on an empty-`detail` internal node.** The answer composer must handle this (either ascend to nearest non-empty `detail`, or refuse and report).

Each of these gets a unit test in `tests/integration/test_graph_smoke.py` with a canned LLM reply.
