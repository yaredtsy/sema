import type { AgentRun } from "../features/trace/types";

/**
 * Static `AgentRun` fixtures used by demo mode and (until Phase 2) by the
 * trace panel. Each `final_answer` is duplicated into the conversation's
 * matching assistant message in `./conversations.ts` — that's the on-the-wire
 * shape, the duplication is intentional.
 */

const RUN_01: AgentRun = {
  run_id: "run-01",
  conversation_id: "conv-01",
  message_id: "msg-02",
  tree_id: "example-cs",
  query: "How does Python's asyncio event loop work?",
  model: "gpt-4.1-mini",
  status: "completed",
  cursor_id: "cs.languages.python.async",
  visited_ids: ["cs", "cs.languages", "cs.languages.python", "cs.languages.python.async"],
  stop_reason: "leaf",
  started_at: "2026-05-23T10:01:00Z",
  finished_at: "2026-05-23T10:01:03Z",
  trace: [
    {
      step_idx: 0,
      node_id: "cs",
      messages_in: [
        {
          role: "system",
          content:
            "You are a routing agent. Given a query and the current tree node, decide whether to descend into a child or answer from the current context.",
        },
        {
          role: "user",
          content: `<context>
<node id="cs" title="Computer Science">
  <description>Root of the CS example tree</description>
  <children>
    <child id="cs.languages" title="Languages">Programming languages and paradigms</child>
    <child id="cs.algorithms" title="Algorithms">Complexity, sorting, search, and graph algorithms</child>
    <child id="cs.systems" title="Systems">Operating systems, networking, and concurrency</child>
  </children>
</node>
</context>

Query: How does Python's asyncio event loop work?`,
        },
      ],
      raw_output: `<decision>
  <reasoning>The query is about Python's asyncio, which is a language-level concurrency feature. "Languages" is the most relevant subtree.</reasoning>
  <action>descend</action>
  <target>cs.languages</target>
  <confidence>0.95</confidence>
</decision>`,
      thinking: {
        text: "The user is asking about asyncio which is a Python concurrency library. This clearly falls under 'Languages' → Python. I should descend into cs.languages first.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.languages",
        reasoning: "asyncio is a Python language feature — 'Languages' subtree covers it.",
        confidence: 0.95,
      },
      model: "gpt-4.1-mini",
      latency_ms: 380,
      input_tokens: 412,
      output_tokens: 58,
    },
    {
      step_idx: 1,
      node_id: "cs.languages",
      messages_in: [
        {
          role: "system",
          content:
            "You are a routing agent. Given a query and the current tree node, decide whether to descend into a child or answer from the current context.",
        },
        {
          role: "user",
          content: `<context>
<node id="cs.languages" title="Languages">
  <description>Programming languages and paradigms</description>
  <children>
    <child id="cs.languages.python" title="Python">General-purpose language with rich ecosystem</child>
    <child id="cs.languages.rust" title="Rust">Systems language with ownership model</child>
  </children>
</node>
</context>

Query: How does Python's asyncio event loop work?`,
        },
      ],
      raw_output: `<decision>
  <reasoning>Query is explicitly about Python's asyncio. Descend into Python node.</reasoning>
  <action>descend</action>
  <target>cs.languages.python</target>
  <confidence>0.99</confidence>
</decision>`,
      thinking: {
        text: "Clear — query mentions Python by name. No ambiguity here. Descend to cs.languages.python.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.languages.python",
        reasoning: "Query names Python explicitly.",
        confidence: 0.99,
      },
      model: "gpt-4.1-mini",
      latency_ms: 290,
      input_tokens: 380,
      output_tokens: 44,
    },
    {
      step_idx: 2,
      node_id: "cs.languages.python",
      messages_in: [
        {
          role: "system",
          content:
            "You are a routing agent. Given a query and the current tree node, decide whether to descend into a child or answer from the current context.",
        },
        {
          role: "user",
          content: `<context>
<node id="cs.languages.python" title="Python">
  <description>General-purpose language with rich ecosystem</description>
  <children>
    <child id="cs.languages.python.async" title="Asyncio &amp; Concurrency">Event loop, coroutines, and async/await patterns</child>
    <child id="cs.languages.python.typing" title="Type System">Static type hints, mypy, and Pydantic</child>
  </children>
</node>
</context>

Query: How does Python's asyncio event loop work?`,
        },
      ],
      raw_output: `<decision>
  <reasoning>The "Asyncio &amp; Concurrency" child is a direct match for the query about asyncio event loop.</reasoning>
  <action>descend</action>
  <target>cs.languages.python.async</target>
  <confidence>0.97</confidence>
</decision>`,
      thinking: {
        text: "The child 'Asyncio & Concurrency' is a perfect match. The description says 'Event loop, coroutines, and async/await patterns' — exactly what the query is asking about.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.languages.python.async",
        reasoning: "'Asyncio & Concurrency' child matches the query precisely.",
        confidence: 0.97,
      },
      model: "gpt-4.1-mini",
      latency_ms: 310,
      input_tokens: 390,
      output_tokens: 52,
    },
  ],
  answer: {
    messages_in: [
      {
        role: "system",
        content:
          "You are a helpful assistant. Answer the user's question using the provided context node.",
      },
      {
        role: "user",
        content: `<context>
<node id="cs.languages.python.async" title="Asyncio &amp; Concurrency">
  <detail>## Asyncio

Python's \`asyncio\` module provides an event loop for cooperative multitasking. \`async def\` defines coroutines; \`await\` suspends execution until a Future resolves. The GIL means CPU-bound work still needs multiprocessing, but I/O-bound tasks scale well with async.</detail>
</node>
</context>

Question: How does Python's asyncio event loop work?`,
      },
    ],
    raw_output:
      "## Python's asyncio Event Loop\n\nPython's `asyncio` module implements **cooperative multitasking** using an event loop...",
    final_text:
      "## Python's asyncio Event Loop\n\nPython's `asyncio` module implements **cooperative multitasking** using an event loop. Here's how it works:\n\n**Core model:** The event loop runs in a single thread. Coroutines (defined with `async def`) are scheduled on the loop. When a coroutine hits an `await` expression, it *suspends* — yielding control back to the loop — and resumes when the awaited operation completes.\n\n**Key primitives:**\n- `asyncio.run(coro)` — creates a loop, runs a coroutine, closes the loop.\n- `await asyncio.sleep(n)` — yields the loop for `n` seconds without blocking the thread.\n- `asyncio.gather(*coros)` — runs multiple coroutines concurrently.\n- `asyncio.create_task(coro)` — schedules a coroutine to run soon (non-blocking).\n\n**GIL caveat:** Because the GIL only releases around I/O and C-extensions, asyncio shines for **I/O-bound** work (HTTP requests, DB queries). For CPU-bound work, use `asyncio.to_thread()` or `ProcessPoolExecutor`.\n\n**Under the hood:** The loop uses `selectors` (epoll/kqueue) to watch file descriptors and wake up the right coroutine when I/O is ready.",
    model: "gpt-4.1-mini",
    latency_ms: 1240,
    input_tokens: 520,
    output_tokens: 210,
  },
  final_answer:
    "## Python's asyncio Event Loop\n\nPython's `asyncio` module implements **cooperative multitasking** using an event loop. Here's how it works:\n\n**Core model:** The event loop runs in a single thread. Coroutines (defined with `async def`) are scheduled on the loop. When a coroutine hits an `await` expression, it *suspends* — yielding control back to the loop — and resumes when the awaited operation completes.\n\n**Key primitives:**\n- `asyncio.run(coro)` — creates a loop, runs a coroutine, closes the loop.\n- `await asyncio.sleep(n)` — yields the loop for `n` seconds without blocking the thread.\n- `asyncio.gather(*coros)` — runs multiple coroutines concurrently.\n- `asyncio.create_task(coro)` — schedules a coroutine to run soon (non-blocking).\n\n**GIL caveat:** Because the GIL only releases around I/O and C-extensions, asyncio shines for **I/O-bound** work (HTTP requests, DB queries). For CPU-bound work, use `asyncio.to_thread()` or `ProcessPoolExecutor`.\n\n**Under the hood:** The loop uses `selectors` (epoll/kqueue) to watch file descriptors and wake up the right coroutine when I/O is ready.",
};

const RUN_02: AgentRun = {
  run_id: "run-02",
  conversation_id: "conv-01",
  message_id: "msg-04",
  tree_id: "example-cs",
  query: "What is Dijkstra's algorithm and when should I use it?",
  model: "gpt-4.1-mini",
  status: "completed",
  cursor_id: "cs.algorithms.graphs",
  visited_ids: ["cs", "cs.algorithms", "cs.algorithms.graphs"],
  stop_reason: "leaf",
  started_at: "2026-05-23T10:03:00Z",
  finished_at: "2026-05-23T10:03:02Z",
  trace: [
    {
      step_idx: 0,
      node_id: "cs",
      messages_in: [
        {
          role: "system",
          content:
            "You are a routing agent. Decide whether to descend into a child or answer from the current context.",
        },
        {
          role: "user",
          content: `<context>
<node id="cs" title="Computer Science">
  <children>
    <child id="cs.languages" title="Languages">Programming languages and paradigms</child>
    <child id="cs.algorithms" title="Algorithms">Complexity, sorting, search, and graph algorithms</child>
    <child id="cs.systems" title="Systems">Operating systems, networking, and concurrency</child>
  </children>
</node>
</context>

Query: What is Dijkstra's algorithm and when should I use it?`,
        },
      ],
      raw_output: `<decision>
  <reasoning>Dijkstra's algorithm is a graph shortest-path algorithm. "Algorithms" subtree covers this.</reasoning>
  <action>descend</action>
  <target>cs.algorithms</target>
  <confidence>0.96</confidence>
</decision>`,
      thinking: {
        text: "Dijkstra is a classic graph algorithm. Clear match for 'Algorithms' subtree, not Languages or Systems.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.algorithms",
        reasoning: "Dijkstra is a graph algorithm — 'Algorithms' subtree.",
        confidence: 0.96,
      },
      model: "gpt-4.1-mini",
      latency_ms: 340,
      input_tokens: 400,
      output_tokens: 50,
    },
    {
      step_idx: 1,
      node_id: "cs.algorithms",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context>
<node id="cs.algorithms" title="Algorithms">
  <children>
    <child id="cs.algorithms.graphs" title="Graph Algorithms">BFS, DFS, shortest path, spanning trees</child>
    <child id="cs.algorithms.dp" title="Dynamic Programming">Memoization, tabulation, optimal substructure</child>
  </children>
</node>
</context>

Query: What is Dijkstra's algorithm and when should I use it?`,
        },
      ],
      raw_output: `<decision>
  <reasoning>"Graph Algorithms" child explicitly covers shortest path algorithms including Dijkstra's.</reasoning>
  <action>descend</action>
  <target>cs.algorithms.graphs</target>
  <confidence>0.98</confidence>
</decision>`,
      thinking: {
        text: "The child 'Graph Algorithms' says 'shortest path, spanning trees' — Dijkstra is the canonical shortest-path algorithm.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.algorithms.graphs",
        reasoning: "'Graph Algorithms' covers shortest path — exact match.",
        confidence: 0.98,
      },
      model: "gpt-4.1-mini",
      latency_ms: 300,
      input_tokens: 370,
      output_tokens: 46,
    },
  ],
  answer: {
    messages_in: [
      { role: "system", content: "Answer using the provided context." },
      {
        role: "user",
        content: `<context>
<node id="cs.algorithms.graphs" title="Graph Algorithms">
  <detail>## Graph Algorithms

**BFS** — explores by layers, optimal for unweighted shortest path. **DFS** — explores depth-first. **Dijkstra** — greedy shortest path for non-negative weights, O((V+E) log V) with a min-heap.</detail>
</node>
</context>

Question: What is Dijkstra's algorithm and when should I use it?`,
      },
    ],
    raw_output: "## Dijkstra's Algorithm\n\nDijkstra's finds the shortest path...",
    final_text:
      "## Dijkstra's Algorithm\n\nDijkstra's algorithm finds the **shortest path from a source node to all other nodes** in a weighted graph.\n\n**How it works:**\n1. Initialize distances: source = 0, all others = ∞.\n2. Use a min-heap (priority queue) ordered by current best distance.\n3. Pop the nearest unvisited node; for each neighbour, relax the edge (update distance if shorter path found).\n4. Repeat until heap is empty.\n\n**Complexity:** O((V + E) log V) with a binary heap.\n\n**Use it when:**\n- Edge weights are **non-negative** (if negative weights exist, use Bellman-Ford).\n- You need single-source shortest paths.\n- Classic use cases: routing protocols (OSPF), navigation apps, network latency minimisation.\n\n**Don't use it when:**\n- Graph has negative-weight edges → Bellman-Ford or SPFA.\n- You only need *unweighted* shortest paths → plain BFS is O(V+E) and simpler.",
    model: "gpt-4.1-mini",
    latency_ms: 980,
    input_tokens: 480,
    output_tokens: 180,
  },
  final_answer:
    "## Dijkstra's Algorithm\n\nDijkstra's algorithm finds the **shortest path from a source node to all other nodes** in a weighted graph.\n\n**How it works:**\n1. Initialize distances: source = 0, all others = ∞.\n2. Use a min-heap (priority queue) ordered by current best distance.\n3. Pop the nearest unvisited node; for each neighbour, relax the edge (update distance if shorter path found).\n4. Repeat until heap is empty.\n\n**Complexity:** O((V + E) log V) with a binary heap.\n\n**Use it when:**\n- Edge weights are **non-negative** (if negative weights exist, use Bellman-Ford).\n- You need single-source shortest paths.\n- Classic use cases: routing protocols (OSPF), navigation apps, network latency minimisation.\n\n**Don't use it when:**\n- Graph has negative-weight edges → Bellman-Ford or SPFA.\n- You only need *unweighted* shortest paths → plain BFS is O(V+E) and simpler.",
};

const RUN_03: AgentRun = {
  run_id: "run-03",
  conversation_id: "conv-01",
  message_id: "msg-06",
  tree_id: "example-cs",
  query: "Explain Rust's borrow checker",
  model: "gpt-4.1-mini",
  status: "completed",
  cursor_id: "cs.languages.rust.ownership",
  visited_ids: ["cs", "cs.languages", "cs.languages.rust", "cs.languages.rust.ownership"],
  stop_reason: "leaf",
  started_at: "2026-05-23T10:05:00Z",
  finished_at: "2026-05-23T10:05:02Z",
  trace: [
    {
      step_idx: 0,
      node_id: "cs",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context><node id="cs" title="Computer Science"><children><child id="cs.languages">Languages</child><child id="cs.algorithms">Algorithms</child><child id="cs.systems">Systems</child></children></node></context>\n\nQuery: Explain Rust's borrow checker`,
        },
      ],
      raw_output: `<decision><reasoning>Borrow checker is a Rust language feature.</reasoning><action>descend</action><target>cs.languages</target><confidence>0.97</confidence></decision>`,
      thinking: { text: "Rust borrow checker → language feature → descend to Languages." },
      decision: {
        kind: "descend",
        child_id: "cs.languages",
        reasoning: "Borrow checker is a Rust language feature.",
        confidence: 0.97,
      },
      model: "gpt-4.1-mini",
      latency_ms: 320,
      input_tokens: 380,
      output_tokens: 42,
    },
    {
      step_idx: 1,
      node_id: "cs.languages",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context><node id="cs.languages"><children><child id="cs.languages.python">Python</child><child id="cs.languages.rust">Rust — Systems language with ownership model</child></children></node></context>\n\nQuery: Explain Rust's borrow checker`,
        },
      ],
      raw_output: `<decision><reasoning>Query is about Rust explicitly. Rust child also mentions "ownership model" which relates to the borrow checker.</reasoning><action>descend</action><target>cs.languages.rust</target><confidence>0.99</confidence></decision>`,
      thinking: {
        text: "Obviously Rust. The child even mentions 'ownership model' which is exactly what the borrow checker enforces.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.languages.rust",
        reasoning: "Query names Rust; child mentions ownership model.",
        confidence: 0.99,
      },
      model: "gpt-4.1-mini",
      latency_ms: 280,
      input_tokens: 360,
      output_tokens: 48,
    },
    {
      step_idx: 2,
      node_id: "cs.languages.rust",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context><node id="cs.languages.rust" title="Rust"><children><child id="cs.languages.rust.ownership">Ownership &amp; Borrowing — Move semantics, lifetimes, and borrow checker</child></children></node></context>\n\nQuery: Explain Rust's borrow checker`,
        },
      ],
      raw_output: `<decision><reasoning>The "Ownership &amp; Borrowing" child directly says "borrow checker".</reasoning><action>descend</action><target>cs.languages.rust.ownership</target><confidence>0.99</confidence></decision>`,
      thinking: {
        text: "Child description literally says 'borrow checker'. Perfect match, descend.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.languages.rust.ownership",
        reasoning: "Child description names 'borrow checker' directly.",
        confidence: 0.99,
      },
      model: "gpt-4.1-mini",
      latency_ms: 260,
      input_tokens: 340,
      output_tokens: 40,
    },
  ],
  answer: {
    messages_in: [
      { role: "system", content: "Answer using the provided context." },
      {
        role: "user",
        content: `<context><node id="cs.languages.rust.ownership" title="Ownership &amp; Borrowing"><detail>Every value has one owner. Moving transfers ownership. References (&amp;T) borrow without taking ownership. Mutable borrows (&amp;mut T) are exclusive. Lifetimes ensure references don't outlive their data.</detail></node></context>\n\nQuestion: Explain Rust's borrow checker`,
      },
    ],
    raw_output:
      "## Rust's Borrow Checker\n\nThe borrow checker enforces Rust's ownership rules at compile time...",
    final_text:
      "## Rust's Borrow Checker\n\nThe borrow checker is the compiler component that enforces Rust's **ownership and borrowing rules** at compile time — with zero runtime overhead.\n\n**The three rules:**\n1. Every value has exactly **one owner**.\n2. When the owner goes out of scope, the value is dropped (freed).\n3. You can have either *one* mutable reference **or** *any number* of immutable references — never both simultaneously.\n\n**What this prevents:**\n- Use-after-free (owner has dropped the value)\n- Double-free (only one owner can drop)\n- Data races (exclusive mutable access)\n\n**Lifetimes** extend this to references: the borrow checker tracks how long a reference is valid and rejects code where a reference could outlive its referent.\n\n```rust\nlet s = String::from(\"hello\");\nlet r1 = &s;      // immutable borrow — ok\nlet r2 = &s;      // second immutable borrow — also ok\n// let r3 = &mut s; // ← compile error: cannot borrow as mutable while borrowed as immutable\nprintln!(\"{} {}\", r1, r2);\n```\n\nThe borrow checker makes memory safety a *type-system property*, not a runtime guarantee.",
    model: "gpt-4.1-mini",
    latency_ms: 1100,
    input_tokens: 460,
    output_tokens: 220,
  },
  final_answer:
    "## Rust's Borrow Checker\n\nThe borrow checker is the compiler component that enforces Rust's **ownership and borrowing rules** at compile time — with zero runtime overhead.\n\n**The three rules:**\n1. Every value has exactly **one owner**.\n2. When the owner goes out of scope, the value is dropped (freed).\n3. You can have either *one* mutable reference **or** *any number* of immutable references — never both simultaneously.\n\n**What this prevents:**\n- Use-after-free (owner has dropped the value)\n- Double-free (only one owner can drop)\n- Data races (exclusive mutable access)\n\n**Lifetimes** extend this to references: the borrow checker tracks how long a reference is valid and rejects code where a reference could outlive its referent.\n\n```rust\nlet s = String::from(\"hello\");\nlet r1 = &s;      // immutable borrow — ok\nlet r2 = &s;      // second immutable borrow — also ok\n// let r3 = &mut s; // ← compile error: cannot borrow as mutable while borrowed as immutable\nprintln!(\"{} {}\", r1, r2);\n```\n\nThe borrow checker makes memory safety a *type-system property*, not a runtime guarantee.",
};

const RUN_04: AgentRun = {
  run_id: "run-04",
  conversation_id: "conv-02",
  message_id: "msg-b02",
  tree_id: "example-cs",
  query: "How does dynamic programming differ from recursion?",
  model: "gpt-4o-mini",
  status: "completed",
  cursor_id: "cs.algorithms.dp",
  visited_ids: ["cs", "cs.algorithms", "cs.algorithms.dp"],
  stop_reason: "leaf",
  started_at: "2026-05-24T09:00:00Z",
  finished_at: "2026-05-24T09:00:02Z",
  trace: [
    {
      step_idx: 0,
      node_id: "cs",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context><node id="cs"><children><child id="cs.languages">Languages</child><child id="cs.algorithms">Algorithms</child><child id="cs.systems">Systems</child></children></node></context>\n\nQuery: How does dynamic programming differ from recursion?`,
        },
      ],
      raw_output: `<decision><reasoning>Dynamic programming is an algorithmic technique. "Algorithms" subtree is correct.</reasoning><action>descend</action><target>cs.algorithms</target><confidence>0.93</confidence></decision>`,
      thinking: {
        text: "DP is an algorithmic paradigm. 'Algorithms' subtree covers this, not Languages or Systems.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.algorithms",
        reasoning: "DP is an algorithmic technique.",
        confidence: 0.93,
      },
      model: "gpt-4o-mini",
      latency_ms: 290,
      input_tokens: 390,
      output_tokens: 48,
    },
    {
      step_idx: 1,
      node_id: "cs.algorithms",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context><node id="cs.algorithms"><children><child id="cs.algorithms.graphs">Graph Algorithms</child><child id="cs.algorithms.dp">Dynamic Programming — Memoization, tabulation, optimal substructure</child></children></node></context>\n\nQuery: How does dynamic programming differ from recursion?`,
        },
      ],
      raw_output: `<decision><reasoning>"Dynamic Programming" child is an exact match.</reasoning><action>descend</action><target>cs.algorithms.dp</target><confidence>0.99</confidence></decision>`,
      thinking: {
        text: "The child literally says 'Dynamic Programming'. Trivial routing decision.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.algorithms.dp",
        reasoning: "Exact name match.",
        confidence: 0.99,
      },
      model: "gpt-4o-mini",
      latency_ms: 240,
      input_tokens: 360,
      output_tokens: 38,
    },
  ],
  answer: {
    messages_in: [
      { role: "system", content: "Answer using the provided context." },
      {
        role: "user",
        content: `<context><node id="cs.algorithms.dp" title="Dynamic Programming"><detail>Breaks a problem into overlapping subproblems. Top-down (memoization) caches recursive calls; bottom-up (tabulation) fills a table iteratively.</detail></node></context>\n\nQuestion: How does dynamic programming differ from recursion?`,
      },
    ],
    raw_output:
      "## Dynamic Programming vs Recursion\n\nRecursion is a technique; DP is an optimization strategy that uses recursion (or iteration) plus *memoization*...",
    final_text:
      "## Dynamic Programming vs Recursion\n\n**Recursion** is a technique where a function calls itself to solve smaller subproblems. It's elegant but can be exponentially slow when the same subproblems are solved repeatedly.\n\n**Dynamic Programming** is an *optimization strategy* that eliminates redundant work by storing results:\n\n| | Pure Recursion | Dynamic Programming |\n|---|---|---|\n| Subproblems | Recomputed | Stored (memoized or tabulated) |\n| Time | Often exponential | Polynomial |\n| Space | Call stack | DP table or memo dict |\n\n**Two flavors:**\n- **Top-down (memoization):** Write the natural recursion, then add a cache (`@functools.lru_cache` in Python). Same call structure, no redundant work.\n- **Bottom-up (tabulation):** Iteratively fill a table from base cases upward. Avoids call-stack overhead.\n\n**Rule of thumb:** if your recursive solution recomputes the same `(args)` multiple times, DP turns it from O(2ⁿ) to O(n²) or better. Classic problems: Fibonacci, Knapsack, LCS, Coin Change.",
    model: "gpt-4o-mini",
    latency_ms: 890,
    input_tokens: 440,
    output_tokens: 195,
  },
  final_answer:
    "## Dynamic Programming vs Recursion\n\n**Recursion** is a technique where a function calls itself to solve smaller subproblems. It's elegant but can be exponentially slow when the same subproblems are solved repeatedly.\n\n**Dynamic Programming** is an *optimization strategy* that eliminates redundant work by storing results:\n\n| | Pure Recursion | Dynamic Programming |\n|---|---|---|\n| Subproblems | Recomputed | Stored (memoized or tabulated) |\n| Time | Often exponential | Polynomial |\n| Space | Call stack | DP table or memo dict |\n\n**Two flavors:**\n- **Top-down (memoization):** Write the natural recursion, then add a cache (`@functools.lru_cache` in Python). Same call structure, no redundant work.\n- **Bottom-up (tabulation):** Iteratively fill a table from base cases upward. Avoids call-stack overhead.\n\n**Rule of thumb:** if your recursive solution recomputes the same `(args)` multiple times, DP turns it from O(2ⁿ) to O(n²) or better. Classic problems: Fibonacci, Knapsack, LCS, Coin Change.",
};

const RUN_05: AgentRun = {
  run_id: "run-05",
  conversation_id: "conv-02",
  message_id: "msg-b04",
  tree_id: "example-cs",
  query: "What's the difference between process and thread scheduling in an OS?",
  model: "gpt-4o-mini",
  status: "completed",
  cursor_id: "cs.systems.os",
  visited_ids: ["cs", "cs.systems", "cs.systems.os"],
  stop_reason: "leaf",
  started_at: "2026-05-24T09:02:00Z",
  finished_at: "2026-05-24T09:02:02Z",
  trace: [
    {
      step_idx: 0,
      node_id: "cs",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context><node id="cs"><children><child id="cs.languages">Languages</child><child id="cs.algorithms">Algorithms</child><child id="cs.systems">Systems — Operating systems, networking, and concurrency</child></children></node></context>\n\nQuery: What's the difference between process and thread scheduling in an OS?`,
        },
      ],
      raw_output: `<decision><reasoning>Process/thread scheduling is a core OS concept. "Systems" subtree is correct.</reasoning><action>descend</action><target>cs.systems</target><confidence>0.97</confidence></decision>`,
      thinking: {
        text: "Process and thread scheduling is squarely in OS territory — 'Systems' subtree.",
      },
      decision: {
        kind: "descend",
        child_id: "cs.systems",
        reasoning: "OS scheduling is in Systems subtree.",
        confidence: 0.97,
      },
      model: "gpt-4o-mini",
      latency_ms: 310,
      input_tokens: 400,
      output_tokens: 46,
    },
    {
      step_idx: 1,
      node_id: "cs.systems",
      messages_in: [
        { role: "system", content: "You are a routing agent." },
        {
          role: "user",
          content: `<context><node id="cs.systems"><children><child id="cs.systems.os">Operating Systems — Processes, scheduling, virtual memory</child></children></node></context>\n\nQuery: What's the difference between process and thread scheduling in an OS?`,
        },
      ],
      raw_output: `<decision><reasoning>"Operating Systems" child explicitly covers processes and scheduling.</reasoning><action>descend</action><target>cs.systems.os</target><confidence>0.99</confidence></decision>`,
      thinking: { text: "Child description says 'Processes, scheduling' — perfect match." },
      decision: {
        kind: "descend",
        child_id: "cs.systems.os",
        reasoning: "Child description names processes and scheduling.",
        confidence: 0.99,
      },
      model: "gpt-4o-mini",
      latency_ms: 270,
      input_tokens: 350,
      output_tokens: 40,
    },
  ],
  answer: {
    messages_in: [
      { role: "system", content: "Answer using the provided context." },
      {
        role: "user",
        content: `<context><node id="cs.systems.os"><detail>Kernel manages CPU time (scheduler), memory (paging/segmentation), and I/O. Processes have isolated address spaces; threads share memory. System calls cross the user/kernel boundary.</detail></node></context>\n\nQuestion: What's the difference between process and thread scheduling in an OS?`,
      },
    ],
    raw_output:
      "## Process vs Thread Scheduling\n\nBoth processes and threads are schedulable units of work...",
    final_text:
      "## Process vs Thread Scheduling\n\nBoth processes and threads are schedulable units, but they differ in isolation and overhead:\n\n**Process:**\n- Has its own address space (virtual memory, file descriptors, signal handlers).\n- Context switching is expensive: the MMU must switch page tables.\n- Isolated — a crash in one process doesn't corrupt another.\n\n**Thread:**\n- Shares the parent process's address space.\n- Context switch is cheaper (same page tables, just register state swap).\n- Communication via shared memory (fast, but needs synchronisation).\n\n**Scheduling levels:**\n- *User-space threads* (M:1 or M:N models): scheduled by a runtime (Go goroutines, Python green threads). The kernel sees one or a few OS threads.\n- *Kernel threads* (1:1 model, used by Linux/Windows): each thread is a schedulable entity; the kernel's scheduler (CFS on Linux) assigns CPU time using priority queues.\n\n**Key insight:** The Linux scheduler treats threads and processes almost identically internally — both are `task_struct` entries. The difference is which resources they share (set via `clone()` flags).",
    model: "gpt-4o-mini",
    latency_ms: 1050,
    input_tokens: 470,
    output_tokens: 210,
  },
  final_answer:
    "## Process vs Thread Scheduling\n\nBoth processes and threads are schedulable units, but they differ in isolation and overhead:\n\n**Process:**\n- Has its own address space (virtual memory, file descriptors, signal handlers).\n- Context switching is expensive: the MMU must switch page tables.\n- Isolated — a crash in one process doesn't corrupt another.\n\n**Thread:**\n- Shares the parent process's address space.\n- Context switch is cheaper (same page tables, just register state swap).\n- Communication via shared memory (fast, but needs synchronisation).\n\n**Scheduling levels:**\n- *User-space threads* (M:1 or M:N models): scheduled by a runtime (Go goroutines, Python green threads). The kernel sees one or a few OS threads.\n- *Kernel threads* (1:1 model, used by Linux/Windows): each thread is a schedulable entity; the kernel's scheduler (CFS on Linux) assigns CPU time using priority queues.\n\n**Key insight:** The Linux scheduler treats threads and processes almost identically internally — both are `task_struct` entries. The difference is which resources they share (set via `clone()` flags).",
};

export const allMockRuns: Record<string, AgentRun> = {
  [RUN_01.run_id]: RUN_01,
  [RUN_02.run_id]: RUN_02,
  [RUN_03.run_id]: RUN_03,
  [RUN_04.run_id]: RUN_04,
  [RUN_05.run_id]: RUN_05,
};
