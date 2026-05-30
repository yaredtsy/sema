# Model selection

> **Status — design.** Today the model lives in `chatStore` as one of two hardcoded strings (`"gpt-4.1-mini"`, `"gpt-4o-mini"`), shown as two pills in the sidebar. The target is a typed registry, per-conversation persistence, per-message override, and a single picker component in the composer.

The backend already enforces a mini-tier allowlist (`MINI_MODEL_ALLOWLIST` in `backend/sace/config.py`). The frontend's job is to make picking from that allowlist obvious, persistent, and easy to extend.

## The model registry

One file. One source of truth. Lives at `playground/features/chat/lib/modelRegistry.ts`.

```ts
export interface ModelDef {
  id: string;                       // matches backend allowlist
  label: string;                    // shown in the picker
  family: 'gpt-4.1' | 'gpt-4o' | 'claude' | 'gemini';
  provider: 'openai' | 'anthropic' | 'google';
  contextWindow: number;            // tokens
  supportsTools: boolean;
  defaultTemperature: number;
  badge?: 'fast' | 'best' | 'cheap' | 'beta';
  description?: string;             // one-line, shown on hover
}

export const MODELS: ReadonlyArray<ModelDef> = [
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    family: 'gpt-4.1',
    provider: 'openai',
    contextWindow: 128_000,
    supportsTools: true,
    defaultTemperature: 0.2,
    badge: 'best',
    description: 'Best routing quality among the mini-tier models.',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    family: 'gpt-4o',
    provider: 'openai',
    contextWindow: 128_000,
    supportsTools: true,
    defaultTemperature: 0.2,
    badge: 'fast',
    description: 'Faster and cheaper; slightly less precise routing.',
  },
] as const;

export const DEFAULT_MODEL_ID = 'gpt-4.1-mini';

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find(m => m.id === id);
}
```

Two rules around this file:

1. **The frontend's `MODELS` array must be a subset of the backend's `MINI_MODEL_ALLOWLIST`.** A model that's in the registry but not in the allowlist will be rejected at POST time — a 422 the user will not understand. Keep them in sync.
2. **Never hardcode a model id in a component.** Use `DEFAULT_MODEL_ID` or read from `useModel()`. The string `"gpt-4.1-mini"` should appear in one file: the registry.

A CI check that diffs `MODELS.map(m => m.id)` against `MINI_MODEL_ALLOWLIST` (loaded via a small Python → JSON dump in `scripts/`) keeps the two halves honest. **Future, not v1** — humans can do this for two entries.

## Two scopes, one picker

The model belongs to a conversation. Picking a model **before** the first message changes the conversation's default. Picking a model **after** the first message either:

- Sets the model for the **next** message only (override), or
- Updates the conversation's default for future messages.

The UI is the same picker; the behavior depends on conversation state.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Composer                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Ask anything about this tree…                                   │ │
│  │                                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ⌘↩ to send       [▼ GPT-4.1 mini · best]                  [Send →] │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ click
                ┌──────────────────────────────────────┐
                │  Model                               │
                │ ───────────────────────────────────  │
                │ ●  GPT-4.1 mini    best   128k       │
                │ ○  GPT-4o mini     fast   128k       │
                │ ───────────────────────────────────  │
                │ [ ] Use for next message only        │  ← appears only if
                │     (otherwise updates default)      │     conv has messages
                └──────────────────────────────────────┘
```

The checkbox is invisible on a new (empty) conversation — there's no "default" yet, so the choice *is* the default.

## Persistence

| State | Where | When |
|---|---|---|
| Conversation's current model | Server: `Conversation.model` column | On conversation create + on default-change |
| Per-message override | Server: `Message.model` column (nullable; null = use conversation default) | On `POST /messages` with `model` in body |
| Picker's current selection (UI state) | `useChatStore.pickerByConv[convId]` | On open of conv; merged with server `Conversation.model` |
| Last-used model (cross-conversation hint) | `localStorage.lastModelId` | On every send |

The URL has a `?model=` param. Its role is narrow: **pre-set the model for *new* conversations only.** It does *not* override an existing conversation's model. Use it for:

- Share links: "try this question with gpt-4o-mini" → `?tree=cs&model=gpt-4o-mini`.
- The tree workspace's **Run tree** button: it can pass `?model=` to force a particular model for the next conversation.

On open:

```ts
const params = usePlaygroundParams();
const conv = useConversation(params.conv);

const initialModel =
  conv?.model              // existing conv: server wins
  ?? params.model          // new conv: URL hint
  ?? localStorage.lastModelId
  ?? DEFAULT_MODEL_ID;
```

Server > URL > localStorage > default. Four-line precedence; document once, never argue.

## API contracts (frontend view)

```
POST /trees/:treeId/conversations
  Body:  { model?: string }                      // optional; server uses default if absent
  → 201 { id, model, ... }

POST /conversations/:convId/messages
  Body:  { text: string, model?: string }        // optional; null = use conversation default
  → 202 { user_message_id, assistant_message_id, run_id, model }

PATCH /conversations/:convId
  Body:  { model: string }                       // change the conversation's default
  → 200 { ... }
```

The backend stores both the conversation default and per-message overrides so replays know exactly which model produced each answer. Adding `model` to a `Message` row is a one-column migration — track it in the API doc.

## The picker component

`playground/features/chat/components/ModelPicker.tsx` — one file, props:

```tsx
interface ModelPickerProps {
  value: string;                              // current model id
  onChange: (id: string) => void;             // commit
  scope: 'conversation' | 'next-message';     // shown as toggle if conv has messages
  onScopeChange?: (scope: 'conversation' | 'next-message') => void;
  disabled?: boolean;                         // while a message is in flight
}
```

Behavior contract:

- Renders a dropdown anchored to its trigger. No portal — keep it inside the composer for keyboard focus.
- Disabled state: while a send is in flight, the picker is read-only and shows the model that's about to be used.
- Keyboard: `↑` / `↓` move selection, `↵` commit, `Esc` close. Wraps.
- Unknown model ids (e.g., the conversation was created with a model since removed from the registry) render as `<id> (unknown)` in red and are pickable so the user can change away from them.

## Picker UX rules

- **No more than two badges.** `best` / `fast` / `cheap` / `beta`. Adding more devalues them.
- **No price displayed in the UI.** The mini tier is small enough that it's noise. Add this later if we open the picker up to non-mini models.
- **No "auto" model.** We don't try to be smart about picking the model for the user. Explicit is better.
- **No "compare" mode in v1.** Side-by-side runs with two models is reserved for v2; the design slot is the `?compare=<run_id>` URL param ([02-url-and-entry.md](./02-url-and-entry.md#future-params)).

## Adding a new model

The smallest possible change:

1. Add the id to `MINI_MODEL_ALLOWLIST` in `backend/sace/config.py` (and any provider-key envs needed).
2. Add an entry to `MODELS` in `playground/features/chat/lib/modelRegistry.ts`.
3. Done.

No component changes, no schema migration (already nullable string on `Message`), no URL contract change. Adding a model is a 10-minute task that touches two files.

If the new model lives in a different family (e.g., the first Anthropic model), the badges and the family enum cover it without code changes — only the picker's family-grouping (if/when added) might want a one-line update.

## Removing a model

A model can be:

- **Removed from the picker** by dropping it from `MODELS`. Existing conversations that used it still render correctly (the picker shows `(unknown)`); future picks can't select it.
- **Rejected on POST** by dropping it from `MINI_MODEL_ALLOWLIST`. Existing messages keep their `model` field for replay accuracy; no DB migration needed.

Conventional order: drop from registry first (UX), drop from allowlist a release later (enforce).

## Where the picker lives in the layout

Inside the composer at the bottom-right of the chat region. Not in the header (the header would be tree-wide; the picker is conversation-scoped). Not in the sidebar (the sidebar is cross-conversation; the picker is per-conv).

```
features/chat/components/
├── ChatPanel.tsx           ── owns the layout
├── MessageList.tsx
├── MessageBubble.tsx
├── Composer.tsx            ── owns the model picker
└── ModelPicker.tsx         ── the picker itself
```

The bubble of a single message renders a small `model: gpt-4.1-mini` tag if the message's `model` differs from the conversation default — surfaces overrides without taking space when they match.

## Cross-references

- [04-state-and-data.md](./04-state-and-data.md#zustand-stores-in-detail) — `useChatStore.pickerByConv` shape.
- [06-chat-history.md](./06-chat-history.md) — model is part of the conversation record; the sidebar shows the most-used model per conv as a faint pill.
- [07-agent-wiring.md](./07-agent-wiring.md) — how the backend uses the model when running a routing/answer pass.
