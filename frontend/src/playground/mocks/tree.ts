import type { Node } from "@/types";

/**
 * The "Computer Science" example tree used by `?demo=1`.
 *
 * Lives here (not behind a fetch) on purpose — demo mode must work offline
 * and produce stable screenshots. Phase 1 swaps mock-mode off when a real
 * `?tree=<id>` is in the URL.
 */
export const mockTree = {
  id: "example-cs",
  name: "Computer Science",
  description: "A small example tree for development",
  root: {
    id: "cs",
    title: "Computer Science",
    description: "Root of the CS example tree",
    detail:
      "A broad survey of computer science topics including languages, algorithms, systems, and data.",
    children: [
      {
        id: "cs.languages",
        title: "Languages",
        description: "Programming languages and paradigms",
        detail:
          "Covers procedural, object-oriented, functional, and scripting languages with their trade-offs.",
        children: [
          {
            id: "cs.languages.python",
            title: "Python",
            description: "General-purpose language with rich ecosystem",
            detail:
              "## Python\n\nUsed for scripting, data science, and backends. Key features include dynamic typing, GIL, asyncio for concurrency, and a vast standard library.",
            children: [
              {
                id: "cs.languages.python.async",
                title: "Asyncio & Concurrency",
                description: "Event loop, coroutines, and async/await patterns",
                detail:
                  "## Asyncio\n\nPython's `asyncio` module provides an event loop for cooperative multitasking. `async def` defines coroutines; `await` suspends execution until a Future resolves. The GIL means CPU-bound work still needs multiprocessing, but I/O-bound tasks scale well with async.",
                children: [],
                tags: ["concurrency", "async"],
              },
              {
                id: "cs.languages.python.typing",
                title: "Type System",
                description: "Static type hints, mypy, and Pydantic",
                detail:
                  "## Python Type System\n\nPython 3.5+ has optional type hints (PEP 484). `mypy` enforces them statically. Pydantic uses hints at runtime for validation. `TypeVar`, `Generic`, `Protocol` enable advanced patterns.",
                children: [],
                tags: ["types"],
              },
            ],
            tags: ["lang"],
          },
          {
            id: "cs.languages.rust",
            title: "Rust",
            description: "Systems language with ownership model",
            detail:
              "## Rust\n\nRust's ownership system enforces memory safety at compile time with zero runtime cost. Borrowing rules prevent data races. Used for WebAssembly, embedded, and high-performance backends.",
            children: [
              {
                id: "cs.languages.rust.ownership",
                title: "Ownership & Borrowing",
                description: "Move semantics, lifetimes, and borrow checker",
                detail:
                  "## Ownership\n\nEvery value has one owner. Moving transfers ownership. References (`&T`) borrow without taking ownership. Mutable borrows (`&mut T`) are exclusive. Lifetimes ensure references don't outlive their data.",
                children: [],
                tags: ["memory"],
              },
            ],
            tags: ["lang", "systems"],
          },
        ],
        tags: [],
      },
      {
        id: "cs.algorithms",
        title: "Algorithms",
        description: "Complexity, sorting, search, and graph algorithms",
        detail:
          "Fundamental algorithm design — Big-O analysis, divide-and-conquer, dynamic programming, greedy, graph traversal (BFS/DFS), shortest paths (Dijkstra, Bellman-Ford).",
        children: [
          {
            id: "cs.algorithms.graphs",
            title: "Graph Algorithms",
            description: "BFS, DFS, shortest path, spanning trees",
            detail:
              "## Graph Algorithms\n\n**BFS** — explores by layers, optimal for unweighted shortest path. **DFS** — explores depth-first, useful for cycle detection and topological sort. **Dijkstra** — greedy shortest path for non-negative weights, O((V+E) log V) with a min-heap.",
            children: [],
            tags: ["graphs"],
          },
          {
            id: "cs.algorithms.dp",
            title: "Dynamic Programming",
            description: "Memoization, tabulation, optimal substructure",
            detail:
              "## Dynamic Programming\n\nBreaks a problem into overlapping subproblems. Top-down (memoization) caches recursive calls; bottom-up (tabulation) fills a table iteratively. Classic examples: Fibonacci, 0/1 Knapsack, Longest Common Subsequence.",
            children: [],
            tags: ["dp"],
          },
        ],
        tags: [],
      },
      {
        id: "cs.systems",
        title: "Systems",
        description: "Operating systems, networking, and concurrency",
        detail:
          "Low-level systems: OS kernels, process scheduling, virtual memory, networking stack (TCP/IP), and hardware–software interfaces.",
        children: [
          {
            id: "cs.systems.os",
            title: "Operating Systems",
            description: "Processes, scheduling, virtual memory",
            detail:
              "## Operating Systems\n\nKernel manages CPU time (scheduler), memory (paging/segmentation), and I/O. Processes have isolated address spaces; threads share memory. System calls cross the user/kernel boundary.",
            children: [],
            tags: ["os"],
          },
        ],
        tags: [],
      },
    ],
    tags: [],
  } as Node,
};
