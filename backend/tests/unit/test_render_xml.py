from __future__ import annotations

from sace.prompts.render_xml import render_node_xml
from sace.schema.node import Node


def test_render_node_xml() -> None:
    node = Node(id="a", title="A", description="desc")
    xml = render_node_xml(node)
    assert 'id="a"' in xml
    assert "<title>A</title>" in xml
