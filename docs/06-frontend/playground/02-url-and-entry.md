# URL & entry flow

> **Status — design.** Today `/playground` takes no params and always renders the same mocks. The contract below is what we build to.

The URL **is** the state. If two URLs are equal, the playground renders the same thing. If a state cannot be reproduced from a URL, the URL is wrong — fix the URL, not the state.

## The route

There is exactly one playground route.

```
/playground
```

All variation comes from query parameters.

## Query parameters

| Param | Required | Type | Meaning | Default if absent |
|---|---|---|---|---|
| `tree` | **yes** | tree id (string) | Which tree the playground is bound to | Render empty state with a "pick a tree" prompt |
| `conv` | no | conversation id (string) | Which conversation is open | Resume most recent for this tree, or create a new one |
| `msg` | no | message id (string) | Which assistant message is being inspected (the "debug target") | None — trace panel shows last message in conversation |
| `step` | no | integer ≥ 0 | Which step inside the focused message is highlighted | None — no step highlight |
| `model` | no | model id (string) | Preselected model for *new* conversations only | Server's default mini model |
| `embed` | no | `1` | Strip the sidebar and divider chrome (for iframes) | Off |
| `demo` | no | `1` | Force mock-data mode regardless of `tree` | Off |

### Rules

1. **`tree` is the only required param.** A playground URL without `tree` renders an empty state — *not* a 404, *not* a redirect. Empty state shows: "Pick a tree from `/`" with a link.
2. **`conv` is auto-managed.** When the playground opens with `tree=X` and no `conv`, the server picks (resume most recent, or create new) and the client immediately calls `history.replaceState` to put `conv=<id>` in the URL. The user never sees a URL without `conv` for more than one paint.
3. **`msg` and `step` are layered on top of `conv`.** If `msg` belongs to a different conversation, the playground silently ignores it (logs a warning, doesn't crash).
4. **`model` only affects *new* conversations.** It does not retroactively change a conversation's model. The conversation's actual model is stored on the server; the URL param is a hint for the next "new conversation" click.
5. **Order doesn't matter.** Params are sorted alphabetically by the codec so that two equivalent URLs are byte-identical (clean for share/copy).
6. **Unknown params are preserved.** The codec drops only params it knows; future params (`compare`, `pin`, …) can be added without breaking older saved links.

## Examples

```
/playground
   → empty state, "pick a tree" prompt

/playground?tree=cs
   → open tree "cs", resume or create a conversation, redirect to ?tree=cs&conv=<id>

/playground?tree=cs&conv=01HXY
   → open conversation 01HXY for tree cs

/playground?tree=cs&conv=01HXY&msg=msg-04
   → same, with assistant message msg-04 focused in the trace panel

/playground?tree=cs&conv=01HXY&msg=msg-04&step=2
   → same, with step 2 of that message's run highlighted on the tree

/playground?tree=cs&model=gpt-4o-mini
   → open tree cs, create a new conversation pre-set to gpt-4o-mini

/playground?tree=cs&conv=01HXY&embed=1
   → same conversation, no sidebar, no padding (iframe mode)

/playground?demo=1
   → load all mocks, ignore tree/conv. Useful for screenshots / offline dev.
```

## The "Run tree" entry point

Two places host the button. Both navigate to the same URL. **Neither knows what conversation will open.**

### From the tree list (`/`)

```
┌────────────────────────────────────────────────────────┐
│  Knowledge trees                          [+ New tree] │
│  ──────────────────────────────────────────────────── │
│  ● Computer Science               4 nodes · cs        │
│        last used 2d ago                                │
│        [Edit]   [▶ Run tree]   [Delete]                │
│  ────                                                  │
│  ● Cooking                        12 nodes · cook     │
│        never used                                      │
│        [Edit]   [▶ Run tree]   [Delete]                │
└────────────────────────────────────────────────────────┘
```

`[Edit]` → `/trees/:treeId`. `[▶ Run tree]` → `/playground?tree=:treeId`. `[Delete]` is unchanged.

### From the tree workspace (`/trees/:treeId`)

A persistent button in the workspace header, next to "Save":

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Trees    Computer Science                  [Save]  [▶ Run tree]│
│             A broad survey...                                       │
└────────────────────────────────────────────────────────────────────┘
```

If the tree has unsaved changes, the button is disabled with the tooltip "Save first to run". This is the only place that gates the entry — the tree list cannot have unsaved changes.

## Lifecycle on open

```
Browser nav to /playground?tree=cs[&conv=...]
        │
        ▼
PlaygroundPage mounts
   1. parse URL  → { tree: 'cs', conv: undefined, msg, step, model, embed, demo }
   2. if !tree:                  render empty state, stop
   3. if demo=1:                 render with mock data, stop
   4. useTree('cs')              ← React Query → GET /trees/cs
   5. if !conv:
        POST /trees/cs/conversations { model? }
        → { id }
        history.replaceState ?tree=cs&conv=<id>&...
        now conv is set
   6. useConversation(conv)      ← React Query → GET /conversations/<conv>
   7. seed chatStore from the conversation
   8. if msg:
        traceStore knows this msg's run already?  yes → set debug target
                                                  no  → useRun(run_id) → GET /runs/<id>
        once loaded → set debug target → if step given → set selected step
   9. first paint
```

Step 5 is the only write on open. Everything else is a read.

## URL ↔ state mapping

The URL drives:

| URL param | State target |
|---|---|
| `tree` | React Query key `['tree', tree]` |
| `conv` | React Query key `['conversation', conv]`, `chatStore.activeConversationId` |
| `msg` | `uiStore.debugTarget = message.run_id` |
| `step` | `uiStore.selectedStepIdx` |
| `model` | initial value for the model picker in the composer (only when creating a new conv) |
| `embed` | `uiStore.embed` (hides sidebar, removes paddings) |
| `demo` | switches the data layer to mocks (a single boolean, threaded as a context) |

The reverse — state changes that push back into the URL:

| State change | Pushes |
|---|---|
| User picks a message to debug | `?msg=<id>` (replace, not push — keeps history clean) |
| User picks a step | `?step=<idx>` (replace) |
| User switches conversation | `?conv=<id>` (push, so back-button returns to previous conversation) |
| User creates new conversation | `?conv=<new id>`, `msg` and `step` dropped (push) |
| User switches tree (via header dropdown if we add one) | `?tree=<id>` (push, also drops `conv`/`msg`/`step` since they belong to the old tree) |
| User toggles embed/demo | replace |

The rule of thumb: **push on intent, replace on incidental**. Picking a message is incidental (you're reading the same conversation); switching conversations is an intent (you wanted to go somewhere else).

## Refresh, share, back

Three properties fall out of the URL contract for free:

1. **Refresh.** Same URL → same lifecycle → same render. No client-side persistence required for navigation state.
2. **Share.** Copy URL, send to teammate, they see the same view (assuming they have access to the tree).
3. **Back-button.** Switching conversations and trees uses `push`; back-button returns to the previous one. Picking a message uses `replace`; back-button doesn't trap the user inside a single conversation's debug history.

## When the URL can't represent the state

Some state intentionally doesn't go in the URL:

| State | Why not |
|---|---|
| Sidebar collapsed/open | Per-user preference. `localStorage`. |
| Column widths | Same. `localStorage`. |
| Composer draft text | Per-conversation in-flight text. `localStorage` keyed by conv id. |
| In-flight run state (live SSE) | Ephemeral; tied to the EventSource lifetime. |

If you find yourself adding to this list, ask first whether it should be in the URL. A surprising amount of "UI state" is actually shareable state in disguise.

## The codec

A single file owns the URL ↔ state translation. See [03-folder-structure.md](./03-folder-structure.md#playgroundurlts) — `playground/url.ts`. Two functions:

```ts
parsePlaygroundUrl(search: string): PlaygroundParams
serializePlaygroundUrl(params: PlaygroundParams): string
```

No component or hook touches `window.location.search` directly. Every read goes through `parse`, every write through `serialize` + `history.replaceState`/`pushState`. This keeps the URL contract testable as a pure function — one test file, no React.

## Future params (slot, not built)

| Param | Meaning | Why deferred |
|---|---|---|
| `compare=<run_id>` | Open a second trace panel showing another run for diff | Needs the diff component, ~v2 |
| `pin=msg-04,msg-07` | Lock several messages into the trace panel at once | Niche; one is enough for v1 |
| `params=<base64 json>` | Override traversal policy (max_depth, beam_width…) | Comes with the agent; v1.5 |
| `experiment=<id>` | Activate a named experimental code path | When experiments framework lands |

Adding any of these is a one-line change to the codec plus a consumer somewhere. No URL contract rewrite.
