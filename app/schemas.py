from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, HttpUrl, field_validator


class ProjectCreate(BaseModel):
    topic: str = Field(min_length=2, max_length=500)
    competitor_url: HttpUrl | None = None
    target_audience: str = Field(default="широкая аудитория", max_length=500)
    writing_style: str = Field(default="экспертный инфостиль", max_length=120)
    desired_length: int = Field(default=1500, ge=300, le=10000)
    main_keyword: str | None = Field(default=None, max_length=500)
    source_outline: str | None = None
    keywords: list[str] = Field(default_factory=list)
    keyword_text: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("topic", "target_audience", "writing_style")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class GenerateArticleRequest(BaseModel):
    use_mock: bool = False


class OneClickRequest(BaseModel):
    competitor_url: HttpUrl
    desired_length: int = Field(default=1500, ge=300, le=10000)
    target_audience: str = Field(default="широкая аудитория", max_length=500)
    writing_style: str = Field(default="экспертный инфостиль", max_length=120)
    use_mock: bool = False
    keyword_limit: int = Field(default=20, ge=5, le=50)


class ScorePayload(BaseModel):
    word_count: int
    promotion_keywords: list[str]
    overall_score: int = Field(ge=0, le=20)
    scores: dict[str, int]
    detailed_breakdown: dict[str, str]
    critical_errors: list[str]
    recommendations: list[str]
