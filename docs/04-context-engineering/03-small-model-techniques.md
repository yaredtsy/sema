# Techniques for OpenAI mini models

Tactics we use to get reliable behavior out of `gpt-4.1-mini` / `gpt-4o-mini`. Most of these become invisible once they're in place; capture them now while we're learning.

## 1. Keep each decision **local**

The defining trick of this whole project. A mini model is good at picking one of 5 options when those 5 options are visible and self-describing. It is bad at picking one of 500 from an embedding's worth of suggestions. The dendrogram converts "1-of-many" into "many 1-of-fews".

## 2. Constrain the output, hard

In order of effectiveness:

1. **Strict format example** at the end of the system prompt. Mini models mimic the most recent shape they saw.
2. **"EXACTLY ONE block. No preamble. No postscript."** Repeat this near where the model starts speaking.
3. **`response_format` if available** (JSON mode, structured outputs). We currently use XML because of cross-mini portability, but `response_format={"type": "json_schema", ...}` is worth piloting.
4. **Validate then retry once.** Don't run an LLM-driven self-correction loop. One retry with a stronger reminder, then fall back.

## 3. Low temperature for decisions

Routing is selection, not creativity. Use `temperature ∈ [0.1, 0.3]`. Higher temperature buys nothing here and increases parse failures. The answer step can be slightly warmer (`0.3–0.5`) but no more.

## 4. Reasoning before action

Place `<reasoning>` *before* `<action>` in the output schema. The model that's about to commit to an action benefits from one or two sentences of explanation immediately prior. This is the entire technique behind "Chain of Thought lite" — and it costs us ~20 output tokens per call.

## 5. Few-shot of one (rarely two)

A single, on-task example is the right dose for mini models. More examples:
- Take up token budget that should be the tree description.
- Bias the model toward the example's domain.

If we need more than one example, that's evidence the prompt itself is unclear.

## 6. Short, distinguishing descriptions

The single biggest accuracy gain we will see comes from the tree itself: **make sibling `description`s sharply distinguishable**. The mini model cannot read your mind; if two children's descriptions could plausibly answer the query, it will guess. Symptom-driven check: when a step is wrong, read the two competing descriptions out loud. If you can't tell them apart in one second, the model can't either.

## 7. Use attributes, not nested tags, for ids

Empirically, mini models echo `id="..."` more accurately than `<id>...</id>`. This is folklore-grade evidence, but the cost of doing it is zero, so we do it.

## 8. Stable schema = cacheable system prompt

The router system prompt is identical across all calls in a run (only the `<query>` and `<context>` differ). With OpenAI's prompt caching, a stable static prefix is rewarded with lower input cost. Keep the rules + examples block above the dynamic substitution.

## 9. Don't ask for what you don't need

If you don't use `confidence`, don't ask for it. Each unused field is one more thing the model can get wrong and one more retry trigger.

## 10. Replay deterministically

Before tuning a prompt, capture a set of "golden traces" with the current prompt. When you change the prompt, re-run the same queries and diff the decisions. This is the only signal that matters; throughput of subjective opinion never tells you whether the change helped.

`scripts/eval_router.py` (TODO) takes a list of `(query, expected_path_ids)` and reports accuracy at each level.

## 11. Treat parse errors as a tree problem first

If the router can't decide, the usual cause is **ambiguous children**, not a broken model. Fix the tree before tuning temperature.

## 12. Pin your model version

`gpt-4.1-mini` resolves to a specific snapshot today; that snapshot can change later. Pin the model id (e.g. `gpt-4.1-mini-2025-04-14` or whatever the dated alias is) in `SACE_MODEL` once routing is calibrated. Bump it deliberately.

## 13. Avoid "you are an expert in X"

Mini models do not improve much from persona priming for routing tasks. The space we save is better spent on rules and the example.

## 14. Strip whitespace before parsing

Mini models occasionally emit a leading newline or stray text. Strip first, then regex.

## Anti-patterns

- **Letting the model "think" in free-form for several paragraphs.** It rambles. Bound the reasoning to one or two sentences.
- **Asking the model to "be careful" or "be accurate".** These do nothing. Show what right looks like; the model will follow.
- **Multiple rounds of self-critique on a single decision.** Wastes calls. If the first attempt is bad, the prompt is bad; fix it.
- **Using mini for evaluation of mini.** Run evaluations against a deterministic ground truth, not "ask another model". Otherwise you have a tail chasing itself.

## When mini isn't enough — and what to do

If a query has a routing accuracy floor we cannot lift past, say 60% on a hand-crafted set, the available knobs in order of cost:

1. **Reshape the tree.** Fix bad descriptions. Split a too-broad parent. Cost: free.
2. **Tighten the prompt.** Stronger examples, sharper rules. Cost: minutes.
3. **Beam-2.** Try the top-2 children and let the answer step disambiguate. Cost: 2× calls.
4. **Drop down a tier** — *not up.* If `gpt-4o-mini` is failing, try `gpt-4.1-mini` (still mini). We do not graduate to non-mini models. That is the experimental constraint.

If after all that mini still fails: that is the negative result. Write it down and we have learned something.
