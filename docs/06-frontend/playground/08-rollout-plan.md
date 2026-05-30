# Rollout plan

> **Status — design.** A phased, file-by-file build order. Each phase is small enough to do in a sitting and ships on its own — the playground stays usable at every step. Backend and frontend can lead each other; the seams are spelled out per phase.

Six phases. Each has scope, files touched, acceptance criteria, and an explicit out-of-scope list so it's obvious what *not* to grow.

## Phase 0 — scaffold the new module

**Goal:** create `src/playground/` with empty regions wired to the existing UI. Zero behavior change for the user; everything still renders from mocks.

**Scope:** mechanical move + the URL codec + the page shell.

**Files created**

```
src/playground/
├── PlaygroundPage.tsx                 ← parses URL, renders shell
├── index.ts                           ← exports PlaygroundPage
├── features/url-state/lib/codec.ts    ← parsePlaygroundUrl / serializePlaygroundUrl
├── features/url-state/hooks/usePlaygroundParams.ts
├── features/url-state/hooks/useSyncUrl.ts
├── common/PlaygroundShell.tsx         ← four-region grid
├── common/EmptyState.tsx              ← "pick a tree" when ?tree missing
├── common/DemoBanner.tsx
└── lib/queryKeys.ts                   ← `qk` factory
```

**Files moved (no logic change)**

```
src/features/tree/TreePanel.tsx
   → src/playground/features/tree-canvas/components/TreeCanvas.tsx
src/features/tree/TreeNode.tsx, layout.ts, highlights.ts
   → src/playground/features/tree-canvas/{components,lib}/
src/features/trace/*
   → src/playground/features/trace/{components,hooks,lib}/
src/features/chat/ChatPanel.tsx, MessageList.tsx, MessageInput.tsx
   → src/playground/features/chat/components/
src/features/chat/ConversationSidebar.tsx
   → src/playground/features/history/components/HistorySidebar.tsx
src/features/chat/hooks.ts
   → src/playground/features/chat/hooks/useSendMessage.ts  (still mock body)
src/store/uiStore.ts, chatStore.ts, traceStore.ts
   → src/playground/stores/useUiStore.ts, useChatStore.ts, useRunsStore.ts
src/data/mockData.ts
   → src/playground/mocks/{tree,conversations,runs}.ts
```

**Router wiring**

```
src/App.tsx
   /playground → src/playground/PlaygroundPage
```

**Acceptance**

- `/playground` renders identically to before.
- `/playground?demo=1` works (mocks).
- `/playground?tree=<id>` (any real id) renders an empty state placeholder ("not wired yet").
- `usePlaygroundParams` returns `{ tree, conv, msg, step, model, embed, demo }`.
- `npm run typecheck` passes.

**Out of scope**

- Network calls. Phase 1.
- Behavior changes. Phase 1.
- Splitting Zustand stores by lifetime. Phase 2.

## Phase 1 — connect the tree

**Goal:** the playground loads a real tree from the backend.

**Scope:** the canvas now reads `GET /trees/:id`. Empty state and demo mode still work.

**Files created / changed**

```
src/playground/hooks/usePlaygroundTree.ts          ← React Query: GET /trees/:id
src/playground/features/tree-canvas/components/TreeCanvas.tsx
   ── replace `import { mockTree }` with `usePlaygroundTree()`
src/playground/PlaygroundPage.tsx
   ── if !params.tree && !params.demo → <EmptyState />
   ── if loading → <Spinner />
   ── if error  → <ErrorBox /> with retry
```

**Entry points (UI changes outside the playground)**

```
src/pages/TreeListPage.tsx
   ── add [▶ Run tree] button per row → navigate(`/playground?tree=${tree.id}`)
src/pages/TreeWorkspacePage.tsx
   ── add [▶ Run tree] in the header → navigate(`/playground?tree=${tree.id}`)
   ── disabled with tooltip when dirty
```

**Acceptance**

- Click **Run tree** on a tree in `/` → lands on `/playground?tree=<id>` with the real tree rendered.
- Same on `/trees/:id`.
- Refresh on the playground URL re-fetches the tree.
- `?demo=1` still renders mocks; `?tree=...&demo=1` prefers demo (loud override).
- Chat panel still shows mock conversations (next phase).

**Out of scope**

- Real conversations / messages. Phase 2.
- Live agent. Phase 4.

## Phase 2 — real conversations & history sidebar

**Goal:** conversations persist to the database; the sidebar shows the real list for the current tree.

**Server prerequisite:** `Conversation` + `Message` tables exist; basic CRUD endpoints from [06-chat-history.md](./06-chat-history.md) are live. Agent reply can still be a server-side stub.

**Files created**

```
src/api/conversations.ts                                   ← listConversations, getConversation,
                                                              createConversation, patch, archive, delete

src/playground/features/history/hooks/useConversations.ts  ← React Query
src/playground/features/history/hooks/useCreateConversation.ts
src/playground/features/history/hooks/useConversationActions.ts
src/playground/features/history/hooks/useConversationFilter.ts
src/playground/features/history/components/HistorySidebar.tsx   ← real
src/playground/features/history/components/ConversationItem.tsx ← real
src/playground/features/history/components/NewConversationButton.tsx
src/playground/features/history/components/SearchInput.tsx
src/playground/features/history/components/DateBucket.tsx
src/playground/features/history/lib/groupByDate.ts
src/playground/features/history/lib/titleFallback.ts

src/playground/features/chat/hooks/useMessages.ts          ← React Query: GET /conversations/:id
```

**Files changed**

```
src/playground/PlaygroundPage.tsx
   ── on mount with no ?conv:
        useCreateConversation() (or resume most recent for this tree)
        history.replaceState ?tree=…&conv=<id>

src/playground/features/chat/components/MessageList.tsx
   ── source from useMessages (no more mocks)
src/playground/features/chat/components/Composer.tsx
   ── stays mock for send (real send is Phase 4)
src/playground/stores/useChatStore.ts
   ── drop mock seeding; start empty
   ── add optimisticByConv + drafts map
```

**Acceptance**

- Opening `/playground?tree=<id>` (no `conv`) auto-creates a conversation and updates the URL.
- Sidebar shows all conversations for the tree.
- Clicking a row navigates to `?conv=<id>` and loads its messages.
- Refresh restores everything.
- Creating, renaming, archiving, deleting a conversation all reflect immediately (optimistic + invalidate).

**Out of scope**

- Real send + SSE. Phase 4.
- Fork, export/import. Phase 6.

## Phase 3 — model selection

**Goal:** picker in the composer, registry-backed, per-conversation persistence + per-message override.

**Files created**

```
src/playground/features/chat/lib/modelRegistry.ts          ← MODELS + DEFAULT_MODEL_ID
src/playground/features/chat/components/ModelPicker.tsx
```

**Files changed**

```
src/playground/features/chat/components/Composer.tsx
   ── render <ModelPicker /> inline
src/playground/features/chat/hooks/useSendMessage.ts
   ── include `model` in POST body (still mock if Phase 4 not done)
src/playground/stores/useChatStore.ts
   ── pickerByConv: Record<convId, { model, scope }>
src/api/conversations.ts
   ── patchConversation({ model })
```

**Server prerequisite:** `Conversation.model` column; `Message.model` nullable column. Backend allowlist already exists.

**Acceptance**

- Picker shows two badges (`best`, `fast`), default `gpt-4.1-mini`.
- New conversation respects `?model=` URL param.
- Changing the picker on a new (empty) conv sets `Conversation.model`.
- Changing on a non-empty conv shows the "Use for next message only" toggle.
- Per-message override renders a small `model:` tag on that bubble.

**Out of scope**

- Compare mode. Reserved for v2.
- Non-mini models. Server-rejected; not a frontend concern.

## Phase 4 — live agent + SSE

**Goal:** real `useSendMessage` against the agent. Tool calls stream; the trace fills in step-by-step; the tree cursor animates.

**Server prerequisite:** LangGraph agent invoked from `POST /messages`; event bus publishes `ai_message`, `tool_call`, `tool_result`, `cursor`, `error`, `final`, `done` per [07-agent-wiring.md](./07-agent-wiring.md).

**Files created**

```
src/playground/lib/eventSource.ts                          ← subscribeRun, backoff, replay-on-reconnect
src/playground/features/trace/lib/reduceEvents.ts          ← pure reducer
src/playground/features/trace/hooks/useLiveTrace.ts        ← subscribe to runs[run_id]
src/playground/features/trace/hooks/useRun.ts              ← React Query GET /runs/:id (replay)
src/playground/features/chat/components/AssistantBubble.tsx
src/playground/features/chat/components/ToolStrip.tsx
src/playground/features/chat/components/LiveTurn.tsx
src/playground/features/chat/lib/formatToolCall.ts
src/playground/features/chat/lib/groupByTurn.ts
src/playground/features/chat/hooks/useTurnGrouping.ts
src/api/runs.ts                                            ← getRun, cancelRun
```

**Files changed**

```
src/playground/features/chat/hooks/useSendMessage.ts
   ── replace mock body:
        optimistic insert
        POST /conversations/:cid/messages
        subscribeRun(run_id, dispatch)
src/playground/stores/useRunsStore.ts
   ── add openRun / appendEvent / closeRun / markError / closeAllForConv
src/playground/features/chat/components/MessageList.tsx
   ── group by turn (HumanMessage + the AI/Tool sequence from its run)
   ── live turn renders LiveTurn; completed renders AssistantBubble
src/playground/features/trace/components/TracePanel.tsx
   ── source from useLiveTrace(run_id) || useRun(run_id)
src/playground/features/tree-canvas/components/TreeCanvas.tsx
   ── overlay reads cursor_id, visited_ids from useLiveTrace || useRun
```

**Acceptance**

- All four "agent is wired" checks from [07-agent-wiring.md](./07-agent-wiring.md#frontend-acceptance-for-agent-is-wired) pass:
  1. User bubble + live placeholder within < 200 ms of send.
  2. Tool calls stream into the strip; tree cursor animates.
  3. Final answer renders; "Show reasoning" link enables.
  4. Refresh re-renders the conversation; "Show reasoning" loads the trace from `GET /runs/:id`.

**Out of scope**

- Concurrent runs UX polish. Phase 5.
- Replay scrubber. Phase 5.

## Phase 5 — debug surface polish

**Goal:** the trace/canvas surface becomes properly inspectable.

**Files changed (small additions, no new feature files)**

```
src/playground/features/trace/components/TracePanel.tsx
   ── scrubber for completed runs (drives selectedStepIdx via URL ?step)
   ── filter / search across tool calls
   ── export current run as JSON (one button)
src/playground/features/tree-canvas/hooks/useNodeHighlights.ts
   ── add step-index badges on visited nodes
   ── add hover tooltip with step N · cursor at … · latency
src/playground/features/chat/components/AssistantBubble.tsx
   ── "Show reasoning" link sets ?msg=<ai_message_id>
src/playground/hooks/useDebugTarget.ts
   ── url ⇄ uiStore mirroring with replaceState (no history pollution)
src/playground/stores/useUiStore.ts
   ── add keyboard shortcuts wiring (j/k/[/]/Esc) at PlaygroundShell
```

**Acceptance**

- Picking a message via "Show reasoning" updates `?msg`; refresh keeps the focus.
- Scrubbing through a completed run dims later steps in the tree.
- Step-index badges appear on visited nodes; hover shows step metadata.
- Keyboard nav works for next/prev step and prev/next message.
- One-button export of a completed run downloads a JSON.

**Out of scope**

- Inline diff between two runs (compare). Reserved for v2.

## Phase 6 — fork, export/import, archive UX

**Goal:** the chat history features that don't block earlier phases.

**Files created**

```
src/api/conversations.ts (extended)
   ── forkConversation, exportConversation
src/api/imports.ts
   ── importConversation
src/playground/features/history/components/ArchivedFooter.tsx
src/playground/features/history/components/ImportButton.tsx
src/playground/features/chat/components/ForkAffordance.tsx
```

**Files changed**

```
src/playground/features/chat/components/AssistantBubble.tsx
   ── add "Fork from here" affordance
src/playground/features/history/components/HistorySidebar.tsx
   ── render ArchivedFooter (collapsed)
   ── render ImportButton in header
```

**Acceptance**

- Fork from any AI bubble creates a new conversation with messages 0..N copied, and navigates to it.
- Archive moves a conversation to the collapsed footer; unarchive returns it.
- Export downloads a self-contained JSON; importing it into another tree creates a new conversation with new ids.

**Out of scope**

- Cross-tree fork. Out — by design conversations are per-tree.
- Server full-text search. Future.

## Cross-cutting cleanup (during any phase)

These can happen alongside any phase; they're not blockers.

- **Delete `src/data/mockData.ts`** once Phase 2 is shipped and `?demo=1` reads from `src/playground/mocks/`.
- **Lint rule: `no-react-in-lib`** — fails any `lib/` file that imports React. Catches drift between [03-folder-structure.md](./03-folder-structure.md#two-lib-files-never-import-react) and reality.
- **Lint rule: `no-cross-feature-imports`** — fails when `features/<a>/` imports from `features/<b>/`. Enforces rule #1.
- **CI: model-allowlist diff** — fail CI if `modelRegistry.ts:MODELS[*].id` and backend `MINI_MODEL_ALLOWLIST` diverge.

## What you can build in parallel (frontend without backend)

If the backend is lagging, the frontend can still ship Phases 0–3 ahead by hardcoding the responses:

- Phase 0: nothing to mock; pure refactor.
- Phase 1: needs `GET /trees/:id` — **already implemented**, ship now.
- Phase 2: needs conversation CRUD. Until ready, use a mock at the `src/api/conversations.ts` boundary — same shape, in-memory. Replace with real later.
- Phase 3: independent of agent.

Phases 4–6 require backend.

## What success at v1.5 looks like

User journey, end to end:

1. Open `/`, see a list of trees they authored.
2. Click **Run tree** on one. Land on `/playground?tree=cs&conv=<new>`.
3. Tree renders. Sidebar shows past conversations (empty for a new tree).
4. Pick a model (or accept default). Type a question. Hit send.
5. User bubble appears instantly. Live "spider walking…" strip grows as the agent traverses.
6. Final answer arrives, formatted, with "Show reasoning" link.
7. Click "Show reasoning" — trace panel fills with the full LangGraph message log; tree canvas highlights the path.
8. Refresh the tab — everything restores from the URL.
9. Copy the URL, paste in another browser — same view.
10. Switch to a past conversation in the sidebar — clean transition; debug target clears.

When all ten work, the playground is real. The rest of the roadmap is polish.
