from __future__ import annotations

from sace.schema.node import Node


def render_node_xml(node: Node, *, include_children: bool = True) -> str:
    """Render a node (and optionally its children) as XML for routing prompts."""
    lines = [
        f'<node id="{node.id}">',
        f"  <title>{_escape(node.title)}</title>",
        f"  <description>{_escape(node.description)}</description>",
    ]
    if include_children and node.children:
        lines.append("  <children>")
        for child in node.children:
            lines.append(render_node_xml(child, include_children=True))
        lines.append("  </children>")
    lines.append("</node>")
    return "\n".join(lines)


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
