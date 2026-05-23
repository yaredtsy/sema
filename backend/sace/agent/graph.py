from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from sace.agent.answer_node import answer_node
from sace.agent.router_node import router_node
from sace.agent.visit_node import visit_node
from sace.schema.state import AgentState


def build_graph() -> Any:
    """Compile the LangGraph traversal graph (minimal stub)."""
    graph: StateGraph = StateGraph(AgentState)
    graph.add_node("router", router_node)
    graph.add_node("visit", visit_node)
    graph.add_node("answer", answer_node)
    graph.set_entry_point("router")
    graph.add_edge("router", "visit")
    graph.add_edge("visit", "answer")
    graph.add_edge("answer", END)
    return graph.compile()
