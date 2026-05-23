# Storage

Trees are JSON files. That is the whole strategy for v1. The reasons:

- We want trees to be **diff-able** in git, **authorable** in a normal editor, and **portable** across machines.
- The dataset is small (KB, not GB). A database is overkill.
- Iteration speed matters more than runtime performance right now.

## On-disk layout

```
data/
└── trees/
    ├── cs.json              # one tree per file
    ├── cooking.json
    └── README.md            # describes what each tree is + its source
```

File name is the canonical `tree_id` (sans `.json`). The store loads everything in `data/trees/*.json` at startup.

## File schema

A file is a serialized `Tree`:

```json
{
  "id": "cs",
  "name": "Computer science survey",
  "description": "A demo tree for testing routing on a broad CS topic.",
  "root": {
    "id": "cs",
    "title": "Computer science",
    "description": "The study of algorithms, computation, and information.",
    "detail": "",
    "children": [
      {
        "id": "cs.languages",
        "title": "Programming languages",
        "description": "Syntax, semantics, paradigms, and notable languages.",
        "detail": "",
        "children": [ ... ]
      },
      ...
    ]
  }
}
```

The same Pydantic model that runs at runtime also validates the JSON. Loader steps:

1. Read the file.
2. `Tree.model_validate_json(raw)` — fails on extra fields, missing fields, bad ids.
3. DFS to build the id→node index, reject duplicates.
4. Register in the store.

If any tree fails to load, the server logs the error and *skips that file*. It does not crash. (We want a half-broken playground over no playground.)

## Hot reload

For dev convenience, the FastAPI `lifespan` watches `data/trees/` with [`watchfiles`](https://github.com/samuelcolvin/watchfiles) and reloads changed trees. The endpoint `POST /api/v1/admin/reload?tree_id=cs` forces a reload for a specific tree.

This is dev-only. In production (if there ever is one) trees are immutable per process.

## Migration story (when we outgrow JSON)

Likely path:
1. **Add SQLite-backed store** — same `TreeStore` interface, `nodes(tree_id, id, parent_id, title, description, detail)` table.
2. **Add an authoring UI** — only when JSON editing becomes painful.
3. **Add multi-tenant** — only if more than one user matters.

We will not pre-build any of these. The current schema is forward-compatible: every node has a stable `id`, and the recursion can be flattened into rows trivially.

## Generation scripts

Sometimes you want to seed a tree from an external source (a markdown book, a Wikipedia outline, a corpus). Put one-off scripts under `scripts/`:

```
scripts/
├── seed_tree.py             # validate + copy a candidate JSON into data/trees/
├── from_markdown.py         # convert a structured markdown outline → Tree
└── stats.py                 # print depth, branching factor, mean description length
```

`stats.py` is worth its weight: when a tree gets too deep or too unbalanced the routing accuracy collapses, and the cheapest signal is its branching factor.

## Conventions for tree authoring

These belong in `data/trees/README.md`, repeated here for visibility:

- **Branching factor 3–7 per level.** Below 3, the level adds no information. Above 7, the router gets confused.
- **Depth ≤ 5.** Deeper trees mean more LLM calls and more compounding errors.
- **Descriptions distinguish, not describe.** A good description tells the router *why this branch and not its sibling*.
- **Detail can be empty for internal nodes.** Don't pad it.
- **One tree per domain.** Don't merge unrelated topics.

These are heuristics. We will measure them as we go.
