from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class EventBase(BaseModel):
    seq: int
    run_id: str
    conversation_id: str = ""
    message_id: str = ""
    ts: str


class StepEvent(EventBase):
    name: Literal["step"] = "step"
    step_idx: int = 0
    node_id: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)


class FinalEvent(EventBase):
    name: Literal["final"] = "final"
    answer: str = ""


class ErrorEvent(EventBase):
    name: Literal["error"] = "error"
    message: str = ""


EventEnvelope = StepEvent | FinalEvent | ErrorEvent
