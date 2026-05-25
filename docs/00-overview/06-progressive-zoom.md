# Progressive zoom — the Google-Maps mental model

The simplest way to describe what the agent does: **it zooms.**

## How you actually use Google Maps

You never see the whole world at the resolution of street names. You couldn't —
the screen has fewer pixels than the world has streets. So Maps does the only
sensible thing: it shows you a level of detail that matches the level of zoom.

- **Zoomed all the way out:** continents and oceans. No streets.
- **Country level:** major cities and highways. Still no streets.
- **City level:** neighborhoods, major roads.
- **Street level:** every alley, every shop, every house number.

When you look for a place, you don't pan the world at street-level resolution
hunting for "Café X". You **zoom in progressively**: pick the continent, pick
the country, pick the city, then look for the street. At each step you decide
*from what is visible at that level*, and what is visible at that level is
**curated** — Maps doesn't drown you in detail you can't yet use.

## The agent does this, exactly

Substitute the words:

| Google Maps | SACE agent |
|---|---|
| The world | The full knowledge corpus |
| Zoom level | Tree depth |
| What's drawn at this zoom | Current node + direct children |
| Pan + pick a region | Choose a child to descend into |
| Arrive at a street address | Stop at a node and answer from it |
| Trip history | Saved `Run`s in the conversation |

At every step, the agent sees a curated slice — the current node and its
immediate children — and makes a zoom-in decision. It does **not** see the
whole tree, ever, just like you never see the whole Earth at street resolution.

## Why this is the right shape for a small model

Two reasons, and they are the same reason looked at from two sides:

1. **Bounded context.** A small model has a small working surface. A zoom step
   is a small problem: "given this region and these sub-regions, which one
   contains what the user wants?" That fits.
2. **Curated visibility.** At each zoom level the *map* has already decided
   what matters. Highways at the country level, alleys at the street level. The
   tree does the same: a node's children are the things you'd want to choose
   between *if you were already at that node*. Siblings are roughly orthogonal
   by construction.

If we showed the model every node at every level in one prompt, we'd be
handing it the world at street resolution. That's the failure mode we are
explicitly avoiding.

## Illumination, not search

A useful reframe: this is not "search the tree for an answer". It is
**progressively illuminating the part of the tree relevant to the query**.

- At the start, only the root is lit. Everything else is dark.
- The model picks a child → that subtree lights up to one more level.
- Repeat. The lit region grows in the direction the query points.
- When the lit frontier is specific enough, stop and answer from the
  brightest point.

The "trace" you see in the debugger is literally the illumination history.
This is also why the tree-overlay debug view ([../06-frontend/05-tree-overlay-debug.md](../06-frontend/05-tree-overlay-debug.md))
is meaningful: the *shape* of what was lit tells you the *shape* of the
agent's reasoning.

## Hierarchy and boundaries are easy from above

A claim hidden inside this metaphor, worth pulling out:

> **Boundaries between topics are easier to see from the top than from the bottom.**

If you stand on a single street it is hard to say where the city ends. If you
fly up, the boundary is obvious — buildings stop, fields begin. Same for
knowledge: from inside a paragraph it is hard to tell whether you've drifted
into a different subtopic, but from a zoomed-out view it is immediate.

The dendrogram is that view. The model does not have to *discover* where one
subject ends and another begins — the tree's structure already says so. The
model only has to decide *which side of the boundary* the user is asking about.
That is a much easier question.

## Failure modes this metaphor exposes

The Maps analogy also surfaces the things that can go wrong, in concrete
terms you can debug:

- **Wrong continent.** The first routing decision sent us into the wrong
  branch. The whole trip is doomed. Look at the root prompt.
- **Right city, wrong neighborhood.** Late wrong turn — usually means two
  sibling nodes are not as orthogonal as they should be. Fix the tree.
- **Refused to zoom in.** Stopped too high; answered from a too-general node.
  Usually a stop-condition issue.
- **Zoomed past the answer.** Kept descending into a leaf when a higher node
  was already specific enough. Stop condition again, other direction.

Each of these is visible in the debug views, on a named node, in a single
trip. That is the payoff of structuring the problem this way.

## Related reading

- The thesis: [05-the-idea.md](./05-the-idea.md).
- Why composition (the *other* thing dendrograms encode) matters: [07-emergence-from-ingredients.md](./07-emergence-from-ingredients.md).
- The traversal loop in code form: [../03-agent/03-traversal-algorithm.md](../03-agent/03-traversal-algorithm.md).
