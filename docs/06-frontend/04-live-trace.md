# Live trace view

The collapsible panel between the tree and the chat. The most "debugger-ish" part of the UI. This is where the experimental value lives — you can see *why* the agent did what it did.

## What it shows

A vertical list of `StepCard`s, one per router decision, plus lifecycle markers.

```
┌───────────────────────────────────────┐
│  Trace                          [✕]   │
├───────────────────────────────────────┤
│  ▼ start  query: "How does …"          │
│                                       │
│  ▼ step 0  at cs                       │
│     decision: descend cs.languages    │
│     "The query is about Python; the   │
│      languages branch is the right    │
│      next step."                      │
│     410ms · 932 in / 64 out           │
│     [show prompt]  [show raw output]  │
│                                       │
│  ▼ step 1  at cs.languages             │
│     ...                               │
│                                       │
│  ▼ answer  cs.languages.python.async   │
│     stop_reason: leaf                 │
│                                       │
│  ▼ done   4 steps · 2890ms total      │
└───────────────────────────────────────┘
```

## Source of truth

It reads exclusively from `traceStore.steps`. The store is populated by the SSE subscriber (`useLiveTrace(run_id)`).

```ts
// frontend/src/features/trace/hooks.ts
export function useLiveTrace(run_id: string | null) {
  useEffect(() => {
    if (!run_id) return;
    const unsub = subscribeEvents(run_id, (event) => {
      switch (event.name) {
        case "start":  traceStore.onStart(event); break;
        case "step":   traceStore.onStep(event); break;
        case "visit":  traceStore.onVisit(event); break;
        case "final":  traceStore.onFinal(event); break;
        case "error":  traceStore.onError(event); break;
        case "done":   traceStore.onDone(event); break;
      }
    });
    return unsub;
  }, [run_id]);
}
```

This hook is mounted in `App.tsx`, not in the trace panel — that way the tree, the chat, and the trace all stay synchronized even if the trace panel is collapsed.

## Step card

Each `StepCard` is self-contained:

- Header: step index, current node id, decision summary
- Body: reasoning (always visible), latency / tokens
- Foldouts (collapsed by default):
  - **Prompt** — the rendered router prompt. The store has only the truncated `prompt_preview`; clicking "Show full prompt" fetches `GET /runs/{id}/steps/{idx}` lazily.
  - **Raw output** — the LLM's raw text before parsing.
  - **Children considered** — the list of `(id, title, description)` from the routing prompt, with the picked one marked.

Clicking the card highlights the node in the tree (`uiStore.selectedNode`).

## Lifecycle markers

`start`, `visit`, `answer_start`, `final`, `done`, `error` appear as smaller markers between step cards. They are not interactive (except `error`, which expands to show the message and `code`).

## Replay mode

A toggle at the top of the panel: **Live ⇆ Replay**. In Replay mode the cards become a scrubber:

- Drag a slider to step `i`.
- The tree shows the cursor state at step `i`, not the latest.
- The chat answer stays as-is.

This is the killer feature for prompt debugging. Implementation: `traceStore` exposes `cursorIdAt(i)` and `visitedIdsAt(i)`, derived from the steps. Components read from these when `replayIndex` is set, otherwise from the live values.

## Diff mode (later)

A second run can be loaded side-by-side. The step list shows pairs:

```
Step 1:   run A: descend cs.langs.python   |   run B: descend cs.langs.rust
```

Implementation note for v1: `traceStore` is shaped to support multiple traces keyed by `run_id`. We just don't render two at once yet.

## Performance

Lists are O(D) — depth, not N. Even depth-10 trees give us 10 step cards. No virtualization needed.

If we ever stream `answer_token` and render incrementally, we throttle re-renders to one per 50ms. The `answer` accumulates into a buffer that flushes on a `requestAnimationFrame`.

## Keyboard

- `j` / `k` — next / previous step
- `Enter` (on a focused step card) — open prompt/output foldouts
- `r` — toggle live/replay

## Why this is the centerpiece

Most agent UIs hide reasoning ("here's your answer"). The debugging surface lives in a separate dashboard. We invert it: **the trace is part of the main UI**, not an afterthought, because the whole point of the project is studying *how* the agent walks the tree. The chat answer is almost incidental compared to the trace.

If we ever ship this as a product, this panel will be one click away — but for the playground, it is always visible.
