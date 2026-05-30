# State & data flow

> **Status — design.** Today the playground reads only from Zustand stores seeded with mock fixtures. The target is three clearly-separated layers — **URL**, **React Query (server cache)**, **Zustand (live + ephemeral)** — each with a single home and a single role. Folder locations are in [03-folder-structure.md](./03-folder-structure.md).

The rule of thumb, with no exceptions:

> **Server data → React Query. Live SSE + UI state → Zustand. Anything in the URL → the URL itself.**

If a piece of state lives in two places, the bug is the second place.

## The three layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│  URL                                                                      │
│  /playground?tree=…&conv=…&msg=…&step=…&model=…&embed=…&demo=…           │
│  ↑ codec: features/url-state/lib/codec.ts                                 │
└─────────────────────────────────────────┬────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  React Query (server cache)                                               │
│  ['tree', treeId]                  → Tree                                 │
│  ['conversations', treeId]         → Conversation[]                       │
│  ['conversation', conversationId]  → Conversation (with messages)         │
│  ['run', runId]                    → AgentState                           │
│  Keys live in lib/queryKeys.ts                                            │
└─────────────────────────────────────────┬────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Zustand (live + ephemeral)                                               │
│  useUiStore   debugTarget, selectedStepIdx, selectedNodeId, sidebarOpen,  │
│               embed                                                       │
│  useChatStore optimistic message inserts, send queue, composer drafts     │
│  useRunsStore live SSE-backed runs[run_id] (streaming only)               │
└──────────────────────────────────────────────────────────────────────────┘
```

Three layers, three rules:

| Layer | Rule | Test |
|---|---|---|
| URL | If two URLs are equal, the playground renders the same thing | `parsePlaygroundUrl(a) === parsePlaygroundUrl(b)` ⇒ same render |
| React Query | Server is the source of truth | Force-refetch should never change the rendered output for an idle user |
| Zustand | Refresh wipes it; that's intended | No persistence except `localStorage` for `composerDrafts` and `sidebarOpen` |

## Single sources of truth

This table is the contract. **No state appears twice.** If a region needs something not listed under its row, the bug is the row — not the region.

| Concern | Source of truth | Read via |
|---|---|---|
| Which tree is open | URL `?tree` | `usePlaygroundParams().tree` |
| Which conversation is open | URL `?conv` | `usePlaygroundParams().conv` |
| Which message is debug-targeted | URL `?msg` (and mirrored into `useUiStore.debugTarget` for read perf) | `useDebugTarget()` |
| Which step is selected | URL `?step` (mirrored into `useUiStore.selectedStepIdx`) | `useUiStore(s => s.selectedStepIdx)` |
| The tree definition | React Query `['tree', treeId]` | `usePlaygroundTree()` |
| Conversation list for a tree | React Query `['conversations', treeId]` | `useConversations()` |
| One conversation + its messages | React Query `['conversation', conversationId]` | `useMessages()` |
| One completed run | React Query `['run', runId]` | `useRun(runId)` |
| One live (streaming) run | `useRunsStore.runs[run_id]` | `useLiveTrace(runId)` |
| Selected tree node (click on canvas) | `useUiStore.selectedNodeId` | `useUiStore(s => s.selectedNodeId)` |
| Composer draft for the open conv | `useChatStore.drafts[conv]` (localStorage) | `useComposerDraft(conv)` |
| Sidebar open / closed | `useUiStore.sidebarOpen` (localStorage) | `useUiStore(s => s.sidebarOpen)` |
| Embed mode | URL `?embed=1` → `useUiStore.embed` | `useUiStore(s => s.embed)` |

URL ↔ Zustand mirroring is **one-way**: URL is canonical; Zustand caches it for fast reads inside event handlers and selectors. The sync hook (`useSyncUrl`) writes URL → store on mount and on `popstate`. Store-initiated changes (user clicks a node, picks a step) call `serializePlaygroundUrl` + `history.replaceState`, which fires `popstate` only on real browser navigation — so we read URL → store again. No loops.

## The four flows

### 1. Entry — opening the playground

```
Browser nav to /playground?tree=cs[&conv=…]
        │
        ▼
PlaygroundPage mounts
   1. parsePlaygroundUrl(window.location.search)
   2. if !tree:        render <EmptyState />, stop
   3. if demo:         render with mock data, stop
   4. usePlaygroundTree(tree)      ── React Query → GET /trees/cs
   5. if !conv:
        useCreateConversation()    ── POST /trees/cs/conversations
        history.replaceState ?tree=cs&conv=<new id>
        (re-render)
   6. useMessages(conv)            ── React Query → GET /conversations/<conv>
   7. if msg:
        useRun(messageToRunId(msg)) ── React Query → GET /runs/<run_id>
        useUiStore.setDebugTarget(run_id)
        if step !== undefined: useUiStore.setSelectedStepIdx(step)
   8. first paint
```

Step 5 is the only write on open. Everything else is a read. The page renders the loading skeleton until 4 + 6 settle; debug-target work runs in parallel and lights up when it's ready.

### 2. Send — user submits a message

```
User submits text in Composer
        │
        ▼
useSendMessage().mutate({ text, model })
   1. optimistic insert into useChatStore:
        - userMsg  (id: local-uuid, status: sent)
        - asstMsg  (id: local-uuid, status: pending, run_id: undefined)
      onSnapshot ── React Query setQueryData(['conversation', conv]) so
                    MessageList re-renders immediately
   2. POST /conversations/:conv/messages { text, model }
        → { user_message_id, assistant_message_id, run_id }
   3. useChatStore.reconcile(localUserId → user_message_id,
                             localAsstId → assistant_message_id,
                             run_id)
      Invalidate ['conversation', conv] so the canonical list refetches.
   4. Open EventSource(/events/<run_id>)
      Subscribe in useRunsStore.openRun(run_id, …)
   5. SSE events arrive:
        step    → useRunsStore.appendStep(run_id, step)
                  (TracePanel re-renders)
        visit   → useRunsStore.appendVisit
        final   → useChatStore.completeAssistant(assistant_message_id, content)
                  useRunsStore.closeRun(run_id)
        error   → useRunsStore.markError; mark assistant message error
        done    → eventSource.close()
                  Invalidate ['run', run_id] (so future replays use server JSON)
```

Two important properties:

- The user's bubble shows up before the network call returns.
- The trace panel fills in step-by-step as SSE arrives — no need to wait for the run to complete.

If the EventSource drops, `lib/eventSource.ts` reconnects with exponential backoff up to 30 s. On reconnect it requests a replay buffer (server-side concern, see [05-api/02-sse-streaming.md](../../05-api/02-sse-streaming.md)) so the trace doesn't gap.

### 3. Debug — picking a past message

```
User clicks an assistant bubble's "Show reasoning" link
        │
        ▼
1. useDebugTarget().set(messageId)
     - history.replaceState ?msg=<messageId>
     - useUiStore.setDebugTarget(message.run_id)
2. useRun(message.run_id) — if not in cache, GET /runs/<id>
3. TracePanel renders from useRun.data
4. TreeCanvas overlays visited/cursor highlights from the same data
```

The same flow works when the user lands on a deep URL (`?msg=foo`) — `usePlaygroundParams` reads `msg`, `useDebugTarget` reads from the store mirror, the run is fetched lazily. No special "initial render" path.

### 4. Exit — leaving the playground (or switching conv/tree)

```
Leaving           Cleanup
─────────         ───────────────────────────────────────────────
URL change        useSyncUrl detects change → useRunsStore.closeAllForConv(old)
                                              useUiStore reset selectedStep/Node
?conv changes     React Query: 'conversation' key changes → new fetch
                  ?msg implicitly cleared (history push, not replace)
?tree changes     React Query: 'tree' key changes → new fetch
                  ?conv/?msg/?step cleared by codec rule
Tab close         EventSources auto-close (browser kills connections)
                  Zustand stores die with the tab (no rehydrate)
                  React Query cache dies with the tab
```

`closeAllForConv(conv)` walks `useRunsStore.runs`, calls `.close()` on each `EventSource` whose `conversation_id` matches. Lost EventSources leak TCP connections; tracking them in the store is the only place to do this cleanup correctly.

## React Query: keys, staleness, prefetch

All keys are minted by one factory file — `playground/lib/queryKeys.ts`:

```ts
export const qk = {
  tree:           (id: string)              => ['tree', id]              as const,
  conversations:  (treeId: string)          => ['conversations', treeId] as const,
  conversation:   (id: string)              => ['conversation', id]      as const,
  run:            (id: string)              => ['run', id]               as const,
} as const;
```

Always import from `qk`. Never inline a string array. This keeps invalidation safe:

```ts
queryClient.invalidateQueries({ queryKey: qk.conversation(conv) });
```

Staleness defaults:

| Key | staleTime | gcTime | Notes |
|---|---|---|---|
| `qk.tree(id)` | 5 min | 30 min | Trees mutate from `/trees/:id`; long stale is fine |
| `qk.conversations(treeId)` | 30 s | 10 min | Sidebar polls feel cheap; refetch on focus |
| `qk.conversation(id)` | 0 s | 30 min | Transcript changes whenever a message is sent — never trust cache without invalidate |
| `qk.run(id)` | Infinity | 30 min | Runs are immutable once `done`. Saved trip = forever-fresh. |

Prefetching is cheap and worth it in three places:

| Trigger | Prefetch |
|---|---|
| Tree list page renders | `qk.tree(id)` for each tree (small, fast) |
| Sidebar hovers a conv | `qk.conversation(convId)` |
| Conversation lands with a `?msg` | `qk.run(runId)` for that msg's run |

## Zustand stores in detail

Three files, each < 80 lines.

### `useUiStore`

```ts
interface UiState {
  // selection
  selectedNodeId: string | null;
  debugTarget: string | null;        // run_id mirror of URL ?msg
  selectedStepIdx: number | null;    // mirror of URL ?step
  // chrome
  sidebarOpen: boolean;              // persisted to localStorage
  embed: boolean;                    // mirror of URL ?embed
  // actions
  setSelectedNodeId: (id: string | null) => void;
  setDebugTarget: (runId: string | null) => void;
  setSelectedStepIdx: (idx: number | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setEmbed: (embed: boolean) => void;
  resetForConv: () => void;          // clears selection state on conv switch
}
```

No async actions. Every action is a pure setter. Side effects (URL writes, query invalidations) live in the hook that calls the action (`useDebugTarget`, `useSyncUrl`).

### `useChatStore`

```ts
interface ChatState {
  // ephemeral local-only state
  optimisticByConv: Record<string, OptimisticMessage[]>;
  drafts: Record<string, string>;        // composer drafts, persisted
  // actions
  pushOptimistic: (convId: string, msg: OptimisticMessage) => void;
  reconcileIds: (convId: string, localId: string, serverId: string,
                 runId?: string) => void;
  removeOptimistic: (convId: string, localId: string) => void;
  completeAssistant: (convId: string, msgId: string, content: string) => void;
  setDraft: (convId: string, text: string) => void;
}
```

Optimistic messages live here until the server's canonical version arrives in React Query. `MessageList` merges `useMessages.data` with `useChatStore.optimisticByConv[conv]` for display.

### `useRunsStore`

```ts
interface RunsState {
  runs: Record<string, LiveRun>;
  sources: Record<string, EventSource>;
  openRun: (runId: string, meta: LiveRunMeta) => void;
  appendStep: (runId: string, step: TraceStep) => void;
  appendVisit: (runId: string, nodeId: string) => void;
  closeRun: (runId: string, final: { answer: string; stop_reason: string }) => void;
  markError: (runId: string, message: string) => void;
  closeAllForConv: (convId: string) => void;
}
```

This store **only** holds live (streaming) runs. Once a run hits `done`, the server has the canonical `AgentState`; the next read goes through React Query. The store still keeps the run for the rest of the session so a user who's watching live doesn't see a flash on switch.

## What does *not* live in Zustand

- **The tree definition.** Always React Query.
- **The conversation transcript.** Always React Query (with `useChatStore.optimisticByConv` merged on top).
- **Completed runs.** Always React Query.
- **Anything reachable from the URL.** Use the URL, mirror to UI store only if read perf matters.

If something feels "obvious" to put in Zustand and it's actually server data or URL-derivable, the answer is no.

## Error and loading conventions

Per layer, one convention.

| Layer | Loading | Error |
|---|---|---|
| URL | n/a | invalid params → ignore + console.warn |
| React Query | `isPending` → render local skeleton inside the component | `isError` → render inline `<ErrorBox />` with retry button |
| Zustand | n/a | `markError` + a dismissable toast |

No `<Suspense>` boundary at the page level — each region handles its own loading state so the rest stays interactive. Suspense is nice; not having it lets us ship sooner.

## Type discipline

- `frontend/src/types/generated.ts` is the **only** place that mirrors backend Pydantic. UI types extend it.
- `playground/features/<x>/types.ts` only adds UI-only shapes (e.g., `OptimisticMessage`, `LiveRunMeta`).
- A hook's return type is its public surface — always exported, always named.

If a component needs a shape that's neither backend-derived nor declared in a feature `types.ts`, that's the smell. Add it where it belongs first.

## What to read next

- [05-model-selection.md](./05-model-selection.md) — how the model gets into a conversation, and how the picker plugs into `useChatStore`.
- [06-chat-history.md](./06-chat-history.md) — how `useConversations` is shaped and how the sidebar consumes it.
- [07-agent-wiring.md](./07-agent-wiring.md) — the future of `useSendMessage` once the agent ships.
