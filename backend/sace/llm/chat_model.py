from __future__ import annotations

from langchain_openai import ChatOpenAI

from sace.config import get_settings


def make_chat_model() -> ChatOpenAI:
    """Return a mini-tier chat model. Raises if settings specify a non-mini model."""
    settings = get_settings()
    settings.validate_model()
    return ChatOpenAI(
        model=settings.sace_model,
        api_key=settings.openai_api_key or None,
        temperature=0,
    )
