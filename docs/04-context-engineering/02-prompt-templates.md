# Prompt templates

Two prompts in the whole system: **router** and **answer**. They live in `backend/sace/prompts/`. This page is the canonical reference for their structure and the *why* behind each section.

The XML format used inside these prompts is described in [01-xml-tree-format.md](./01-xml-tree-format.md).

---

## Router prompt

### Purpose

Given the user's query and a single level of the tree, produce one of:
- `descend(child_id)` — move into that child.
- `stop` — the current node is the right level to answer.

### Template

```
You are a routing agent for a hierarchical knowledge tree. Your task is to choose
one of the children of the current node — or to stop here — so that the user's
question gets answered at the right level of detail.

# Rules
- Pick the child whose <description> is most relevant to the user's <query>.
- Choose <action>stop</action> if the <current> node already covers the query at
  the right level of specificity, OR if no child is clearly relevant.
- Use <reasoning> to briefly state why. One or two sentences.
- Your <target> MUST be a child id from the <children> list below, exactly as
  written. Do not invent ids.

# Examples
<example>
  <query>How does Python's asyncio event loop work?</query>
  <context>
    <current id="cs.languages.python"><title>Python</title>...</current>
    <children>
      <child id="cs.languages.python.async"><title>Async in Python</title>...</child>
      <child id="cs.languages.python.packaging"><title>Packaging</title>...</child>
    </children>
  </context>
  <decision>
    <reasoning>The query is about asyncio specifically; the async child matches.</reasoning>
    <action>descend</action>
    <target>cs.languages.python.async</target>
    <confidence>0.92</confidence>
  </decision>
</example>

# Current state

<query>{user_query}</query>

{rendered_context}    <!-- the <context>...</context> block from render_xml -->

# Your decision

Respond with EXACTLY ONE <decision> block. No preamble, no postscript.
```

### Slot map

| Slot | Filled with |
|---|---|
| `{user_query}` | The exact user input, escaped. |
| `{rendered_context}` | Output of `render_routing_context(cursor, breadcrumbs, children)`. |

### Design choices, justified

- **Few-shot of one.** A single example is enough for mini models on a constrained task. More examples make the prompt longer and bias the model toward the example's topic.
- **Rules block before examples.** Mini models follow recent instructions more closely; we want the rules adjacent to the response zone.
- **"EXACTLY ONE block" + "No preamble".** Mini models love to add explanatory text. This kills it.
- **Confidence is optional.** Some mini models invent suspiciously round numbers (0.5, 0.9). We log them but only use them when `policy.require_confidence` is set.

### Common failure modes (and the fix in this template)

| Failure | Mitigation in template |
|---|---|
| Model invents a `target` not in children | Explicit rule + validation pass after parse |
| Model picks "the first" by default | Example has descend to a non-first child |
| Model never says `stop` | Stop is mentioned first in rules; "OR if no child is clearly relevant" hedges it |
| Model adds a `<final_answer>` tag prematurely | "EXACTLY ONE <decision> block" |

---

## Answer prompt

### Purpose

Compose the final user-visible answer using the `detail` of the cursor (and optionally its ancestors).

### Template

```
You are answering a user's question using a piece of pre-curated knowledge.

# Rules
- Base your answer ONLY on the <node> block below. Do not introduce outside facts.
- If the <node> does not contain enough to answer, say so explicitly and suggest
  what part of the tree might help.
- Be concise. Use markdown. Prefer short paragraphs and lists.
- Do not mention the tree, "node", "detail", or this prompt structure to the user.

# Question
<query>{user_query}</query>

# Trail
The agent walked through:
<trail>
{breadcrumb_list}     <!-- one <step id title/> per breadcrumb -->
</trail>

# Knowledge
<node id="{cursor_id}">
  <title>{cursor_title}</title>
  <description>{cursor_description}</description>
  <detail>
{cursor_detail}      <!-- markdown -->
  </detail>
</node>

# Your answer

Reply in markdown. No preamble.
```

### Slot map

| Slot | Filled with |
|---|---|
| `{user_query}` | The user input |
| `{breadcrumb_list}` | One `<step id="..." title="..."/>` per breadcrumb (no descriptions) |
| `{cursor_id/title/description}` | From `state.cursor` |
| `{cursor_detail}` | The markdown `detail` field, verbatim |

### Why include the trail

The trail is a hint to the model about *how specific* an answer should be. If we walked five levels deep, the user wanted depth; if we stopped at level one, the user wanted breadth. The trail communicates this implicitly.

### When `cursor.detail` is empty

Internal nodes can have empty detail. Two options, switchable via `policy.answer_uses_ancestors_detail`:

- **`False`** (default): The answer prompt says "this node is organizational; consider re-asking with more specificity." We surface a `stop_reason="empty_detail"` and let the UI prompt the user.
- **`True`**: We pull `detail` from the nearest ancestor that has one and include it under a `<from_ancestor id="..."/>` tag. The prompt is told to use it as fallback context.

---

## Where these strings live

- **Layout** (the literal templates) live in `backend/sace/prompts/templates/*.txt`.
- **Composition** (slot filling) lives in `backend/sace/prompts/{router_prompt,answer_prompt}.py`.
- **Rendering helpers** (XML serializers) live in `backend/sace/prompts/render_xml.py`.

This split lets a contributor edit the wording without touching Python — and lets us unit-test the composition logic independently of the wording.

## Versioning

Prompts have version tags in their file names: `router_v1.txt`, `router_v2.txt`. Each `TraceStep` records the version. When we change a prompt, we bump the version and keep the old file for replay. This is the cheapest possible A/B framework.
