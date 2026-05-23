# Tech stack

The chosen tools, what they buy us, and the alternatives we considered.

## Backend

| Tool | Version | Role | Why |
|---|---|---|---|
| Python | 3.12+ | Language | Modern typing, `match` statements, perf improvements |
| `uv` | latest | Package + venv | Already in use (`pyproject.toml` + `uv.lock`) |
| FastAPI | 0.115+ | HTTP + SSE | Async-first, type-validated request bodies via Pydantic |
| `pydantic` | v2 | Schemas | Single source of truth for the `Node` type, JSON I/O |
| LangGraph | latest | Agent graph runtime | Stateful, streamable, debuggable |
| LangChain core | latest | LLM abstractions | Provider-agnostic chat models, output parsers |
| `langchain-openai` | latest | OpenAI binding | The only LLM provider we use (mini tier) |
| `sse-starlette` | latest | SSE helper | Cleaner than rolling our own `EventSourceResponse` |
| `networkx` | 3.6+ | Tree utilities | Already in deps; useful for traversal helpers & viz export |
| `httpx` | latest | Outbound HTTP | Used by OpenAI SDK under the hood |
| `pytest` + `pytest-asyncio` | latest | Tests | Standard |

## Models — small only, on purpose

This is a constraint, not a default. The whole hypothesis is:

> *Can a **small** model answer hard questions if the knowledge is pre-structured into a dendrogram and each decision is local?*

So we **only** use OpenAI mini-tier models. We never reach for a frontier model as a "control" — if mini fails, the experiment fails, and that is the finding.

| Model | Use |
|---|---|
| `gpt-4.1-mini` | Primary — routing decisions and final answer composition |
| `gpt-4o-mini` | Secondary — cheaper, used for quick ablations |
| `gpt-5-mini` / future mini tier | Drop-in when available |

Rules of the experiment:
- Never call a non-mini model from agent code.
- Wrap all LLM access behind one `ChatModel` factory that **only** instantiates a mini model. Calling it with anything else raises.
- All prompt tuning targets the mini tier. If something only works on a bigger model, that is a negative result and we record it.

## Frontend

| Tool | Version | Role | Why |
|---|---|---|---|
| React | 18+ | UI | Familiar, ecosystem |
| Vite | 5+ | Build | Fast HMR, no config drama |
| TypeScript | 5+ | Types | The `Node` and `Event` shapes are shared with the backend |
| TanStack Query | 5+ | Server state | Caches `/tree`, retries, status |
| Zustand | latest | Client state | Tiny, no Redux ceremony |
| React Flow | 11+ | Tree visualization | Pan/zoom, custom node renderers, edge animations |
| Tailwind CSS | 3+ | Styling | Fast iteration on a three-panel layout |
| `react-markdown` | latest | Render `detail` | The `detail` field is markdown |
| `eventsource` polyfill | optional | SSE in older browsers | Probably unnecessary in dev |

We consider `D3` for the tree but **default to React Flow** — D3 forces imperative DOM and we don't need its layout engine; React Flow gives us a maintained component model.

## Dev tooling

| Tool | Role |
|---|---|
| `ruff` | Python lint + format |
| `mypy` (strict on core modules) | Type checking |
| `prettier` + `eslint` | Frontend lint + format |
| `pre-commit` | Local hook runner (optional) |
| `make` (or `just`) | One-liner for `dev`, `test`, `seed` |

## What we are *not* using (and why)

- **No database.** Trees live in `data/trees/*.json`. Persistence is `git`.
- **No Docker for dev.** `uv run` + `npm run dev` is enough.
- **No Redux / RTK.** Zustand handles the small amount of cross-component state.
- **No WebSockets.** SSE is one-way and sufficient; see [05-api/02-sse-streaming.md](../05-api/02-sse-streaming.md).
- **No vector DB.** The whole point is to avoid one.
- **No Next.js.** SSR adds nothing; Vite SPA is simpler.
- **No non-mini models.** See the "Models" section above — this is a hard rule.

## Version policy

Keep `pyproject.toml` and `package.json` as the source of truth. Pin minors; allow patches. Bump explicitly and note model/library changes in a `CHANGELOG.md` once we have one.
