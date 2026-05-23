# XML tree format

How we serialize a `Node` (and its children) into the prompt. This is the single biggest lever on routing accuracy. Treat it with care.

## Why XML, not JSON

Three reasons, in order of importance:

1. **Robustness of model parsing.** Across model families, models stay closer to the demanded XML structure than to JSON when prompted, especially with small models. JSON's commas and brackets are an easy source of malformed output.
2. **Readable when streamed.** XML reads almost like outlined prose; JSON does not.
3. **Loose schema.** Adding a new field is just a new tag — no escaping, no quotes.

We also use XML because it composes well with Anthropic-style "reasoning before action" prompts, which translate cleanly to OpenAI mini models too.

## The shape we render

A routing prompt's tree section looks like this:

```xml
<context>
  <breadcrumbs>
    <crumb depth="0" id="cs" title="Computer science"/>
    <crumb depth="1" id="cs.languages" title="Programming languages"/>
  </breadcrumbs>

  <current id="cs.languages">
    <title>Programming languages</title>
    <description>Syntax, semantics, paradigms, and notable languages.</description>
  </current>

  <children>
    <child id="cs.languages.python">
      <title>Python</title>
      <description>Dynamic, interpreted, batteries-included; strong in data and scripting.</description>
    </child>
    <child id="cs.languages.rust">
      <title>Rust</title>
      <description>Statically typed systems language with ownership-based memory safety.</description>
    </child>
    <child id="cs.languages.haskell">
      <title>Haskell</title>
      <description>Pure functional language with a strong static type system and lazy evaluation.</description>
    </child>
  </children>
</context>
```

## Rules

1. **`detail` never appears in a routing prompt.** Only in the answer prompt.
2. **One `<child>` per child**, in original order. Order can be a signal; we preserve it.
3. **IDs are attributes, not nested tags.** The LLM is more likely to echo `id="cs.languages.python"` correctly when it sees it as a quoted attribute.
4. **Titles are < 80 chars; descriptions < 280 chars** (enforced by schema).
5. **No nested children inside `<child>`** in routing prompts — at most one level visible. Deeper sight is an ablation switch (`policy.show_grandchildren`).
6. **No escaping nightmares.** Descriptions are constrained text (no HTML); we escape `<`, `>`, `&` in renderer to be safe.

## The renderer (sketch)

```python
# backend/sace/prompts/render_xml.py
from xml.sax.saxutils import escape

def render_routing_context(
    cursor: Node,
    breadcrumbs: list[Node],
    children: list[Node],
) -> str:
    crumbs = "\n".join(
        f'    <crumb depth="{i}" id="{escape(n.id)}" title="{escape(n.title)}"/>'
        for i, n in enumerate(breadcrumbs)
    )
    kids = "\n".join(
        f'    <child id="{escape(c.id)}">\n'
        f'      <title>{escape(c.title)}</title>\n'
        f'      <description>{escape(c.description)}</description>\n'
        f'    </child>'
        for c in children
    )
    return (
        "<context>\n"
        "  <breadcrumbs>\n"
        f"{crumbs}\n"
        "  </breadcrumbs>\n"
        f'  <current id="{escape(cursor.id)}">\n'
        f"    <title>{escape(cursor.title)}</title>\n"
        f"    <description>{escape(cursor.description)}</description>\n"
        "  </current>\n"
        "  <children>\n"
        f"{kids}\n"
        "  </children>\n"
        "</context>"
    )
```

Implementation note: we do **not** use Python's `xml.etree` for rendering. Output stability under exact whitespace matters, and we want the result to *look* like the example above byte-for-byte. The price of writing it by hand is small and worth it.

## The decision output schema

The model must reply with one `<decision>` block:

```xml
<decision>
  <reasoning>One or two sentences about why this branch matches the query.</reasoning>
  <action>descend</action>           <!-- or "stop" -->
  <target>cs.languages.python</target>  <!-- required when action=descend -->
  <confidence>0.85</confidence>      <!-- 0..1, optional -->
</decision>
```

Parser is a regex pair (one for the outer block, one for each inner tag). We tested using `lxml` here and found it too strict — small models occasionally produce slightly malformed XML that a forgiving regex parses anyway. We *prefer* forgiveness and validate the resulting fields.

## Token budget per prompt

Rough math for an average level (B=5 children, descriptions ~150 chars, titles ~40, breadcrumbs ~3):

```
breadcrumbs: 3 × ~50 chars  = 150 chars
current:                     ~250 chars
children: 5 × ~250 chars   = 1250 chars
overhead (tags, indent):     ~250 chars
                              ────
                              ~1900 chars  ≈ 500 tokens
```

Plus the surrounding instruction template (~400 tokens) → ~900 tokens per routing prompt. For a depth-5 traversal: ~4.5k input tokens total. With mini pricing this is well under one cent.

## When to break the rules

- If the tree's natural fan-out is high (B > 10), switch to a more compact format: drop `<title>` (use just the id), or render children one per line: `<child id="..." desc="..."/>`. Re-measure routing accuracy after the change.
- If a level needs grandchildren visibility, render an inner `<children>` inside each `<child>` but with `<title>` only (no descriptions). Toggle via `policy.show_grandchildren = True`.

Document every format change as an experiment in `docs/experiments/`.
