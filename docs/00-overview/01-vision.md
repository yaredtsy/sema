# Vision

## What we are building

A **research playground** to test a single hypothesis:

> *If knowledge is pre-structured as a hierarchy of progressively more specific nodes, a small LLM can answer queries about it by **walking** the tree, one decision at a time — and this walk may be cheaper and more interpretable than RAG over flat chunks.*

The artifact will be:
- A **Python backend** that stores a dendrogram of knowledge nodes and runs a LangGraph agent that traverses it.
- A **React frontend** with three regions:
  - **Left/Middle** — a live visualization of the tree, with the agent's current position and history highlighted.
  - **Right** — a chat panel to ask the agent questions.
- A **Server-Sent Events (SSE)** stream so the frontend sees each node visit, each LLM call, each decision, in real time.

The goal is *not* a production product. The goal is **a laboratory** that makes the agent's reasoning visible so we can iterate on prompt design and tree shape.

## Why this is interesting

Most RAG systems do:
```
user query → embed → vector search → top-k flat chunks → LLM → answer
```

That works, but:
- The retriever is a black box; you can only debug it by inspecting cosine scores.
- The chunks are flat — no "zoom level". A query that needs the *summary* gets the same shape of result as one that needs the *detail*.
- The LLM never has to *decide* anything about retrieval. It just consumes whatever the retriever spat out.

Tree traversal flips this:
```
user query → LLM sees root + children → LLM picks branch → repeat → leaf node → answer
```

Properties we want to study:
1. **Interpretability.** Every step is a labeled decision. You can replay it.
2. **Locality.** At each step the LLM only sees one node's children. The prompt stays small even for huge trees.
3. **Small-model viability.** The hypothesis: if each decision is between ~5 short children, an **OpenAI mini-tier model** (e.g. `gpt-4.1-mini`, `gpt-4o-mini`) is enough. We constrain ourselves to mini models only — no frontier-model "control" — because that constraint *is* the experiment.
4. **Cost shape.** Many cheap mini-model calls vs. one expensive embed + one expensive frontier call. We want to actually measure this.

## Non-goals

- We are not building a knowledge editor for end users. The tree authoring happens in code/JSON for now.
- We are not building auth, multi-tenant, or persistence beyond a local store.
- We are not benchmarking against production RAG systems. We just want to *see* how the traversal behaves.

## Success criteria (for the playground itself)

You can sit in front of the UI, type a question, and watch the agent walk the tree. You can see which child it picked at each level, the reasoning, and the final answer. You can swap the prompt, swap the model, reshape the tree, and immediately observe the effect.

That is the entire bar. Everything else is iteration on top of that loop.
