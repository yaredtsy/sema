from __future__ import annotations

from sace.schema.node import Node
from sace.prompts.render_xml import render_node_xml


def build_router_prompt(*, query: str, node: Node) -> str:
    """Build the routing decision prompt for the current node."""
    xml = render_node_xml(node)
    return f"Query: {query}\n\nCurrent subtree:\n{xml}\n\nDecide whether to descend or stop."
