# The idea — spread the data, spread the decisions

This page is the thesis behind SACE. The rest of the system is downstream of it.

## The bet

> **A small model becomes useful when the *task* is broken up to match its size.**

Mini-tier models (`gpt-4o-mini`, `gpt-4.1-mini`, and smaller open models) fail
when you hand them a giant prompt and a giant decision in one shot. They do not
fail because they cannot read — they fail because they cannot **hold the whole
problem at once and decide globally**. Their working surface is small. So:
shrink each individual decision to match.

That is the entire bet. Spread the work across many small, local decisions
instead of compressing it into one big call.

## What "spread" means here

There are two axes to spread along:

### 1. Spread the *data*

Instead of stuffing the whole knowledge base into one prompt (or pulling a
flat top-k from a vector index), pre-structure the knowledge as a **dendrogram**:

- The **root** says what this body of knowledge is, roughly.
- Each **level** narrows the topic.
- A **leaf** is small enough to answer from.

At any moment, the model only ever sees:
- The current node's title + description + (maybe) detail.
- The titles + one-line descriptions of its direct children.
- The user query, and a breadcrumb of where it has already been.

That is a tiny prompt. The rest of the tree is *out of scope on purpose*. The
structure is doing the work the model would otherwise have to do internally.

![Dendrogram — clusters compose into larger clusters](../../assets/dendogram.png)

### 2. Spread the *decisions*

Instead of "read everything, then answer", the loop is:

```
at current node:
  read self + children
  decide: descend(child_id) | stop
  if stop → answer from this node's detail
```

Each LLM call is one routing decision. A run is *many* of those in a row.

This means:
- Each prompt is short → cheap → fast → robust to the small model's limits.
- Each decision is **labeled and local** → every wrong turn has a name.
- The hierarchy *itself* prunes the search space — the model never wastes
  attention on branches it already decided against.

## Why this beats one-shot for a small model

A frontier model can brute-force its way through bad prompt structure. A small
model cannot. Compare two strategies for the same query against the same
corpus:

| | One-shot RAG with mini | Tree traversal with mini |
|---|---|---|
| Prompt size | Whole top-k, often noisy | Current node + direct children |
| Decisions in one call | "Read everything, synthesize, answer" | "Pick a child, or stop" |
| Where the structure lives | Implicit in the embedding space | Explicit in the tree |
| What a wrong answer tells you | Almost nothing | The exact node where it turned wrong |
| Failure mode | Hallucination, lost middle | Pick a wrong child — visible, fixable |

The frontier model hides bad inputs behind raw capability. The small model
exposes them. Trees expose them at a *named* location — which is the whole
point of the debugger ([01-vision.md](./01-vision.md)).

## The structure is the prior

A vector index treats every chunk as equally retrievable. A dendrogram bakes in
a **prior**: *these things belong together, and this thing is a kind of that
thing*. That prior is exactly what the small model is missing when it has to
work from flat text.

Put differently: we are not asking the model to *learn* the structure of the
domain at inference time. We are *giving* it the structure and asking only,
"given this map, which way next?" That is a much smaller question.

## What we are *not* claiming

- Not that this beats frontier-model RAG on accuracy. It probably does not.
- Not that authoring a good tree is free. It is the cost we are paying instead
  of paying for a bigger model.
- Not that this works for every domain. It works for domains that *have*
  hierarchy — most do, more than people credit.
- Not that flat RAG is bad. It is great when the model is big.

## How the rest of the docs connect to this idea

- **Top-down zoom**, the user-facing analogy: [06-progressive-zoom.md](./06-progressive-zoom.md).
- **Composition / ingredients**, why small parts can stand in for unknown wholes: [07-emergence-from-ingredients.md](./07-emergence-from-ingredients.md).
- **The traversal algorithm**, the actual loop: [../03-agent/03-traversal-algorithm.md](../03-agent/03-traversal-algorithm.md).
- **Prompt shape per step**, how we keep each call small: [../04-context-engineering/01-xml-tree-format.md](../04-context-engineering/01-xml-tree-format.md).
- **Why the debugger matters**, what visible reasoning buys us: [01-vision.md](./01-vision.md).
