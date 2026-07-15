from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RecordMixin:
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    status: Mapped[str] = mapped_column(String(32), default="created", index=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class Project(RecordMixin, Base):
    __tablename__ = "projects"

    topic: Mapped[str] = mapped_column(String(500))
    competitor_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    target_audience: Mapped[str] = mapped_column(String(500), default="широкая аудитория")
    writing_style: Mapped[str] = mapped_column(String(120), default="экспертный инфостиль")
    desired_length: Mapped[int] = mapped_column(Integer, default=1500)
    main_keyword: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_outline: Mapped[str | None] = mapped_column(Text, nullable=True)

    keywords: Mapped[list["Keyword"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    articles: Mapped[list["Article"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    outline_items: Mapped[list["OutlineItem"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    prompt_runs: Mapped[list["PromptRun"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    scores: Mapped[list["ScoreResult"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Keyword(RecordMixin, Base):
    __tablename__ = "keywords"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    phrase: Mapped[str] = mapped_column(String(500), index=True)
    frequency: Mapped[int | None] = mapped_column(Integer, nullable=True)
    traffic: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="file")
    project: Mapped[Project] = relationship(back_populates="keywords")


class Article(RecordMixin, Base):
    __tablename__ = "articles"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text)
    model_name: Mapped[str] = mapped_column(String(200), default="mock")
    project: Mapped[Project] = relationship(back_populates="articles")


class OutlineItem(RecordMixin, Base):
    __tablename__ = "outline_items"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    level: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer)
    project: Mapped[Project] = relationship(back_populates="outline_items")


class PromptRun(RecordMixin, Base):
    __tablename__ = "prompt_runs"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    response_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(100), default="mock")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    project: Mapped[Project] = relationship(back_populates="prompt_runs")


class ScoreResult(RecordMixin, Base):
    __tablename__ = "score_results"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    article_id: Mapped[int] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True)
    overall_score: Mapped[int] = mapped_column(Integer)
    result: Mapped[dict[str, Any]] = mapped_column(JSON)
    project: Mapped[Project] = relationship(back_populates="scores")
