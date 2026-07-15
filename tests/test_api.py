from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base.metadata.create_all(engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db


def test_full_mock_workflow():
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        created = client.post(
            "/projects",
            json={
                "topic": "Автоматизация SEO-контента",
                "main_keyword": "SEO автоматизация",
                "keywords": ["SEO автоматизация", " seo   статьи ", "SEO автоматизация"],
                "desired_length": 800,
            },
        )
        assert created.status_code == 201, created.text
        project_id = created.json()["project"]["id"]
        assert len(created.json()["keywords"]) == 2

        analyzed = client.post(f"/projects/{project_id}/analyze")
        assert analyzed.status_code == 200, analyzed.text
        assert analyzed.json()["project"]["status"] == "analyzed"
        assert analyzed.json()["outline"]
        assert all(item["source"] == "mock" for item in analyzed.json()["keywords"])

        generated = client.post(f"/projects/{project_id}/generate-article", json={"use_mock": True})
        assert generated.status_code == 200, generated.text
        body = generated.json()
        assert body["articles"][0]["content"].startswith("#")
        assert 0 <= body["scores"][0]["overall_score"] <= 20

        for export_format in ("json", "csv", "xlsx"):
            exported = client.get(f"/projects/{project_id}/export?format={export_format}")
            assert exported.status_code == 200
            assert exported.content


def test_rejects_project_without_topic():
    with TestClient(app) as client:
        response = client.post("/projects", json={"keywords": ["test"]})
    assert response.status_code == 422


def test_accepts_multipart_txt_and_normalizes_keywords():
    with TestClient(app) as client:
        response = client.post(
            "/projects",
            data={"topic": "Контент-маркетинг"},
            files={"keyword_file": ("keywords.txt", "  seo текст  \nSEO ТЕКСТ\nконтент план\n".encode("utf-8"), "text/plain")},
        )
    assert response.status_code == 201, response.text
    assert [item["phrase"] for item in response.json()["keywords"]] == ["seo текст", "контент план"]
