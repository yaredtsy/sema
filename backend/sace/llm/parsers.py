from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class RoutingDecision:
    action: str
    target_id: str | None = None


def parse_routing_xml(text: str) -> RoutingDecision:
    """Parse a minimal XML routing response (stub)."""
    action_match = re.search(r"<action>(\w+)</action>", text)
    target_match = re.search(r"<target>([^<]+)</target>", text)
    action = action_match.group(1) if action_match else "stop"
    target = target_match.group(1).strip() if target_match else None
    return RoutingDecision(action=action, target_id=target)
