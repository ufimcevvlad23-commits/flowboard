from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.dependencies import get_competitor_service
from app.main import app
from app.services.competitor import CompetitorAnalysisError, CompetitorPage, CompetitorService, _public_host
from app.config import Settings


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base.metadata.create_all(engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


class FakeCompetitorService:
    def analyze(self, url: str, keyword_limit: int = 20) -> CompetitorPage:
        return CompetitorPage(
            url=url,
            topic="Автоматизация SEO-контента",
            main_keyword="автоматизация seo",
            keywords=["автоматизация seo", "seo статьи", "контент план", "генерация контента"][:keyword_limit],
            clusters=[
                {"label": "автоматизация seo", "phrases": ["автоматизация seo", "seo статьи"]},
                {"label": "контент план", "phrases": ["контент план", "генерация контента"]},
            ],
            headings=[(1, "Автоматизация SEO-контента"), (2, "Как составить контент-план")],
            description="Практическое руководство по SEO-автоматизации.",
            source_word_count=1200,
        )


class StaticCompetitorService(CompetitorService):
    def _fetch(self, url: str) -> tuple[str, str]:
        paragraphs = " ".join(
            "Автоматизация SEO помогает создавать полезные статьи, собирать ключевые слова и строить контент план."
            for _ in range(20)
        )
        return (
            f"""<html><head><title>Автоматизация SEO — практическое руководство</title>
            <meta name="description" content="Как автоматизировать подготовку SEO-статей"></head>
            <body><h1>Автоматизация SEO-контента</h1><h2>Сбор ключевых слов</h2>
            <h2>Подготовка контент-плана</h2><p>{paragraphs}</p></body></html>""",
            url,
        )


def test_one_click_url_creates_finished_article():
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_competitor_service] = lambda: FakeCompetitorService()
    with TestClient(app) as client:
        response = client.post(
            "/one-click",
            json={"competitor_url": "https://competitor.example/article", "use_mock": True},
        )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["project"]["status"] == "completed"
    assert body["project"]["topic"] == "Автоматизация SEO-контента"
    assert body["project"]["metadata"]["workflow"] == "one-click"
    assert body["project"]["metadata"]["competitor"]["clusters"]
    assert len(body["keywords"]) == 4
    assert body["outline"]
    assert body["articles"][0]["content"].startswith("#")
    assert 0 <= body["scores"][0]["overall_score"] <= 20


def test_extracts_topic_keywords_and_clusters_from_html():
    page = StaticCompetitorService(Settings()).analyze("https://example.com/article", keyword_limit=12)
    assert page.topic == "Автоматизация SEO-контента"
    assert page.main_keyword
    assert 5 <= len(page.keywords) <= 12
    assert page.clusters
    assert page.source_word_count > 100


def test_rejects_private_competitor_address():
    with pytest.raises(CompetitorAnalysisError):
        _public_host("http://127.0.0.1/private")
