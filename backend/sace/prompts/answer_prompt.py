from __future__ import annotations

from sace.schema.node import Node


def build_answer_prompt(*, query: str, node: Node, trace_summary: str = "") -> str:
    """Build the final-answer prompt using node detail and traversal trace."""
    parts = [f"Query: {query}", f"Node: {node.title}", f"Detail:\n{node.detail}"]
    if trace_summary:
        parts.append(f"Trace:\n{trace_summary}")
    return "\n\n".join(parts)
