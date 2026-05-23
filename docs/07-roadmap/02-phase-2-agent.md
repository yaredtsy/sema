# Phase 2 — Agent

**Goal:** The traversal works end-to-end on the command line. Given a query, the agent walks the seed tree using a mini OpenAI model and returns an answer. No frontend yet.

**Done when:** `uv run python -m sace.cli ask cs "How does Python's asyncio event loop work?"` prints the trace (one line per step) and the final answer.

## Tasks

### 2.1 LLM access — mini-only
- `backend/sace/llm/chat_model.py` — `make_chat_model(model: str | None = None)`.
- Allowlist enforced inside the factory: `{"gpt-4.1-mini", "gpt-4o-mini", "gpt-5-mini"}`. Raises `ValueError` otherwise.
- Default from `SACE_MODEL` env.
- Wraps `langchain_openai.ChatOpenAI` for now (single dependency).

### 2.2 Prompt rendering
- `backend/sace/prompts/render_xml.py` — `render_routing_context(cursor, breadcrumbs, children) -> str`.
- `backend/sace/prompts/router_prompt.py` — composes the full router prompt from a template file.
- `backend/sace/prompts/answer_prompt.py` — composes the answer prompt.
- `backend/sace/prompts/templates/router_v1.txt`, `answer_v1.txt` — the templates from [04-context-engineering/02-prompt-templates.md](../04-context-engineering/02-prompt-templates.md).
- `backend/sace/llm/parsers.py` — XML regex parser for `<decision>` blocks; one-retry-on-fail logic.

### 2.3 LangGraph wiring
- `backend/sace/schema/state.py` — full `AgentState` TypedDict + `TraceStep` model.
- `backend/sace/agent/policies.py` — `TraversalPolicy` dataclass.
- `backend/sace/agent/router_node.py` — async function: builds prompt, calls LLM, parses, appends `TraceStep`, returns state delta.
- `backend/sace/agent/visit_node.py` — moves cursor, decides loop vs. stop via conditional edge.
- `backend/sace/agent/answer_node.py` — composes final answer.
- `backend/sace/agent/graph.py` — `build_graph()` returns compiled `StateGraph`.

### 2.4 CLI
- `backend/sace/cli.py` — `ask <tree_id> <query>` and `replay <run_json_path>` subcommands.
- Print each `TraceStep` as one line: `[depth] node_id → action target  ("reasoning…")`.
- Print the final answer.
- Save the full state JSON to `runs/{run_id}.json` if `--save` flag is given.

### 2.5 Tests
- `tests/unit/test_render_xml.py` — golden-file tests on the XML output.
- `tests/unit/test_parsers.py` — feed canned LLM outputs (good, malformed, missing tag) and assert behavior.
- `tests/integration/test_graph_smoke.py` — full graph run with a fake LLM that returns pre-recorded decisions; asserts the path and final cursor.
- A `FakeLLM` in `tests/fixtures/` that returns next item from a list.

### 2.6 Eval harness (minimal)
- `scripts/eval_router.py` — read a YAML of `(query, expected_path_ids)` pairs and run the graph, comparing actual vs. expected at each level.
- Output a table: query, depth, hit/miss.
- This will live and grow as we tune prompts.

## Out of scope for Phase 2

- FastAPI server
- SSE
- Frontend
- Beam search
- Multi-turn

## Decisions to validate during Phase 2

- Whether `gpt-4.1-mini` reliably picks the right branch when descriptions are sharp.
- Whether one retry on parse failure is enough.
- Whether the breadcrumb summary in the router prompt helps or just costs tokens.

Each becomes an item in `docs/experiments/` once we have data.

## Time estimate

Two focused days for plumbing; another two for prompt iteration on the eval harness.

## Risks

- **Cold-start prompt tuning.** The first 10 queries will probably misroute. Trust the eval harness, not vibes.
- **Token accounting.** OpenAI returns usage; LangChain's wrapper exposes it but the field path drifts across versions. Lock the version and write a tiny test that asserts the field exists.
