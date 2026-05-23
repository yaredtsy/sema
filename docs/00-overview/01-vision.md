# Vision

## The metaphor: GPS history for an agent

Think of Google Maps' trip history. Every drive you ever took is stored. You can:
- Scroll back to any trip.
- See the **route on the map** — every street the car drove down.
- Read the **turn-by-turn list** — "left on Oak, right on Main, continue 0.4 mi".
- Replay it from the start.

SACE is that, for an agent walking a knowledge tree.

Every user message in the conversation is a *trip*. The tree is the *map*. The agent's walk through the tree is the *route*. The debugger lets you scroll back to any past message and see:

- The **route on the map** — the visited nodes lit up on the tree (the tree-overlay debug view).
- The **turn-by-turn list** — each decision unfolded inline in the chat (the chat-style debug view).

Both views show the same trip from different angles. Pick a different message in the chat — both views switch to that trip.

## What we are building, concretely

A **research playground** with two interlocking goals:

1. **A hypothesis to test.**
   > *If knowledge is pre-structured as a hierarchy of progressively more specific nodes, an OpenAI mini-tier model can answer queries by **walking** the tree, one local decision at a time.*

2. **A debugger to make the walk visible.**
   > *Every prompt the agent sent, every token it read, every tool it used, every node it touched — visible live and replayable per past message, on two synchronized views (tree-route and turn-by-turn).*

The hypothesis is interesting. The GPS-history debugger is what makes it *learnable* — you can stare at a wrong answer, scroll back to the message, and watch the exact wrong turn the agent took.

## The system, at a glance

- A **dendrogram of knowledge nodes** (title, description, detail, children) — the map.
- A **LangGraph agent** that walks the tree, one routing decision per LLM call — the driving.
- A **React frontend** with three regions:
  - **Tree view (the map)** — the dendrogram. Overlays change depending on which trip you're inspecting.
  - **Debug panel (trip details)** — pick which past message to debug; inspect each step.
  - **Chat panel (the conversation)** — multi-turn chat, streamed Cursor-style (thinking, tool calls, intermediate outputs all visible inline as the agent works).
- **SSE stream** for live trips; **saved `AgentState` JSON** for replaying past ones.

## Why the debugger matters more than the answer

Most agent UIs hide the reasoning: you ask, you wait, you get an answer. When it's wrong you have nothing to look at.

Here the design assumption is the opposite: **the reasoning is the product**. The chat answer is a side effect of a walk; the walk is what we're studying. So the frontend gives equal real estate to the trace, and offers two ways to inspect it:

- **Chat-style debug** (Cursor-like). Thinking, tool use, and intermediate outputs unfold inline inside the assistant message. Familiar to anyone who has used a modern AI coding tool. This is the *turn-by-turn list*.

- **Tree-overlay debug**. The same trip projected *onto the map*. Each visited node lights up; clicking a node shows the prompt context the agent saw there, the messages exchanged, the LangGraph state at that step, the decision it made. This is the *route on the map*.

Both views are derived from the same `AgentState` for the selected message. They are two faces of one record.

## Multi-turn — pick which message to debug

Conversations have many messages. At any moment you can pick **one assistant message** in the chat and ask: *"show me how the agent produced this one."* The debug panel and tree overlay snap to that message's run. Pick another — both views switch. The chat itself keeps streaming the current turn; inspecting an old turn doesn't interrupt the live one.

Just like GPS history: looking at last Tuesday's drive doesn't pause the current navigation.

## Why this is interesting (the hypothesis side)

Most RAG systems do:
```
user query → embed → vector search → top-k flat chunks → LLM → answer
```

That works, but:
- The retriever is a black box.
- Chunks are flat — no zoom level.
- The LLM never has to *decide* anything about retrieval.

Tree traversal flips this:
```
user query → LLM sees root + children → LLM picks branch → repeat → leaf-ish node → answer
```

Properties we want to study:
1. **Interpretability.** Every step is a labeled decision. You can see exactly what the agent saw.
2. **Locality.** Each prompt is one level. Big trees, small prompts.
3. **Mini-model viability.** OpenAI mini-tier only. No frontier "control". If mini fails, that's the finding.
4. **Cost shape.** Many cheap calls vs. one expensive embed + one expensive frontier call.

## Non-goals

- Not a production product.
- Not a node editor for end users (authoring is JSON in v1).
- Not a benchmark against vector RAG.
- Not multi-tenant or auth — local playground only.

## Success criteria

You sit in front of the UI and:
1. Have a multi-turn conversation with the agent over a tree.
2. Pick any past assistant message and watch its run replay — choose chat-style or tree-overlay view, freely.
3. See, for any visited node, the exact prompt the agent saw, what it answered, what it decided, what the LangGraph state was at that step.
4. Swap the prompt template, swap the tree, swap the mini model — and immediately observe the effect on past or new runs.

If that loop is fast and the surface is honest, the playground has succeeded. The hypothesis result (does mini routing actually work?) is the bonus on top.
