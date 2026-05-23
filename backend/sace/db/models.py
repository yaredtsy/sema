from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sace.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class TreeRow(Base):
    __tablename__ = "trees"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    nodes: Mapped[list[NodeRow]] = relationship(
        back_populates="tree",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class NodeRow(Base):
    __tablename__ = "nodes"

    tree_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("trees.id", ondelete="CASCADE"),
        primary_key=True,
    )
    id: Mapped[str] = mapped_column(String(256), primary_key=True)
    parent_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(String(280), nullable=False)
    detail: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tags_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    tree: Mapped[TreeRow] = relationship(back_populates="nodes")
