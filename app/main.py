from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import HTMLResponse, Response
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database import create_db_and_tables, get_db
from app.dependencies import get_competitor_service, get_llm_service, get_traffic_service
from app.models import Article, Keyword, OutlineItem, Project, PromptRun, ScoreResult
from app.schemas import GenerateArticleRequest, OneClickRequest, ProjectCreate
from app.services.competitor import CompetitorAnalysisError, CompetitorPage, CompetitorService
from app.services.export import build_export
from app.services.keywords import KeywordFileError, normalize_keywords, parse_keyword_text, read_keyword_file
from app.services.llm import LLMService
from app.services.outline import OutlineNode, build_outline
from app.services.scoring import score_article
from app.services.traffic import TrafficService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="SEO Article Factory MVP",
    version="0.1.0",
    description="Локальный сервис подготовки, генерации, оценки и экспорта SEO-статей.",
    lifespan=lifespan,
)
Db = Annotated[Session, Depends(get_db)]
TEMPLATE_PATH = Path(__file__).parent / "templates" / "index.html"


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Проект {project_id} не найден.")
    return project


def common(record) -> dict[str, Any]:
    return {
        "id": record.id,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "status": record.status,
        "metadata": record.metadata_json or {},
    }


def project_payload(db: Session, project: Project) -> dict[str, Any]:
    keywords = db.query(Keyword).filter_by(project_id=project.id).order_by(Keyword.frequency.desc().nullslast(), Keyword.id).all()
    outline = db.query(OutlineItem).filter_by(project_id=project.id).order_by(OutlineItem.position).all()
    articles = db.query(Article).filter_by(project_id=project.id).order_by(Article.id.desc()).all()
    scores = db.query(ScoreResult).filter_by(project_id=project.id).order_by(ScoreResult.id.desc()).all()
    prompts = db.query(PromptRun).filter_by(project_id=project.id).order_by(PromptRun.id.desc()).all()
    return {
        "project": {
            **common(project),
            "topic": project.topic,
            "competitor_url": project.competitor_url,
            "target_audience": project.target_audience,
            "writing_style": project.writing_style,
            "desired_length": project.desired_length,
            "main_keyword": project.main_keyword,
            "source_outline": project.source_outline,
        },
        "keywords": [{**common(k), "phrase": k.phrase, "frequency": k.frequency, "traffic": k.traffic, "source": k.source} for k in keywords],
        "outline": [{**common(item), "level": item.level, "title": item.title, "position": item.position} for item in outline],
        "articles": [{**common(a), "title": a.title, "content": a.content, "model_name": a.model_name} for a in articles],
        "scores": [{**common(s), "article_id": s.article_id, **s.result} for s in scores],
        "prompt_runs": [{**common(p), "provider": p.provider, "prompt": p.prompt, "response_excerpt": p.response_excerpt, "error": p.error} for p in prompts],
    }


async def parse_create_request(request: Request) -> tuple[ProjectCreate, list[str]]:
    content_type = request.headers.get("content-type", "")
    file_keywords: list[str] = []
    try:
        if "application/json" in content_type:
            raw = await request.json()
        elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
            form = await request.form()
            raw = {key: value for key, value in form.multi_items() if not isinstance(value, UploadFile)}
            upload = form.get("keyword_file")
            if upload and hasattr(upload, "read"):
                file_keywords = read_keyword_file(upload.filename or "keywords.txt", await upload.read())
            raw["keywords"] = form.getlist("keywords")
            if raw.get("metadata") and isinstance(raw["metadata"], str):
                import json

                raw["metadata"] = json.loads(raw["metadata"])
        else:
            raise HTTPException(status_code=415, detail="Используйте application/json или multipart/form-data.")
        payload = ProjectCreate.model_validate(raw)
        keywords = normalize_keywords(payload.keywords + parse_keyword_text(payload.keyword_text) + file_keywords)
        return payload, keywords
    except (ValidationError, ValueError, KeywordFileError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def optional_analysis_keywords(request: Request) -> list[str]:
    if not request.headers.get("content-length") or request.headers.get("content-length") == "0":
        return []
    content_type = request.headers.get("content-type", "")
    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            upload = form.get("keyword_file")
            result = read_keyword_file(upload.filename or "keywords.txt", await upload.read()) if upload and hasattr(upload, "read") else []
            result.extend(form.getlist("keywords"))
            result.extend(parse_keyword_text(form.get("keyword_text")))
            return normalize_keywords(result)
        if "application/json" in content_type:
            raw = await request.json()
            return normalize_keywords(list(raw.get("keywords", [])) + parse_keyword_text(raw.get("keyword_text")))
    except (ValueError, KeywordFileError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    raise HTTPException(status_code=415, detail="Для файла используйте multipart/form-data, для списка — JSON.")


def apply_analysis(db: Session, project: Project, traffic_service: TrafficService) -> str | None:
    existing = db.query(Keyword).filter_by(project_id=project.id).order_by(Keyword.id).all()
    phrases = normalize_keywords([keyword.phrase for keyword in existing])
    if not phrases and project.main_keyword:
        phrases = [project.main_keyword]
        db.add(Keyword(project_id=project.id, phrase=project.main_keyword, source="manual", status="imported"))
        db.flush()
        existing = db.query(Keyword).filter_by(project_id=project.id).all()
    if not phrases:
        raise HTTPException(status_code=422, detail="Добавьте хотя бы одно ключевое слово перед анализом.")

    metrics, warning = traffic_service.enrich(phrases)
    by_phrase = {keyword.phrase.casefold(): keyword for keyword in existing}
    for metric in metrics:
        keyword = by_phrase.get(metric.phrase.casefold())
        if keyword:
            keyword.frequency = metric.frequency
            keyword.traffic = metric.traffic
            keyword.source = metric.source
            keyword.metadata_json = {**(keyword.metadata_json or {}), **metric.metadata}
            keyword.status = "analyzed"
    if not project.main_keyword:
        project.main_keyword = max(metrics, key=lambda item: item.frequency).phrase
    db.query(OutlineItem).filter_by(project_id=project.id).delete(synchronize_session=False)
    nodes = build_outline(project.topic, project.source_outline, phrases)
    db.add_all(OutlineItem(project_id=project.id, level=node.level, title=node.title, position=node.position, status="ready") for node in nodes)
    project.status = "analyzed"
    project.metadata_json = {**(project.metadata_json or {}), "analysis_warning": warning}
    db.flush()
    return warning


def create_generated_article(
    db: Session,
    project: Project,
    llm_service: LLMService,
    use_mock: bool,
    source_context: str | None = None,
) -> Article:
    items = db.query(OutlineItem).filter_by(project_id=project.id).order_by(OutlineItem.position).all()
    if not items:
        raise HTTPException(status_code=409, detail="Сначала сформируйте outline проекта.")
    main_keyword = project.main_keyword or project.topic
    nodes = [OutlineNode(item.level, item.title, item.position) for item in items]
    prompt = llm_service.build_prompt(
        project.topic,
        main_keyword,
        nodes,
        project.target_audience,
        project.writing_style,
        project.desired_length,
        source_context=source_context,
    )
    project.status = "generating"
    content, provider, warning = llm_service.generate(prompt, project.topic, main_keyword, nodes, use_mock)
    run = PromptRun(project_id=project.id, prompt=prompt, provider=provider, response_excerpt=content[:1000], error=warning, status="completed" if not warning else "fallback")
    article = Article(project_id=project.id, title=project.topic, content=content, model_name=provider, status="generated", metadata_json={"warning": warning})
    db.add_all([run, article])
    db.flush()
    keyword_phrases = [row.phrase for row in db.query(Keyword).filter_by(project_id=project.id).all()]
    result = score_article(content, main_keyword, keyword_phrases)
    db.add(ScoreResult(project_id=project.id, article_id=article.id, overall_score=result["overall_score"], result=result, status="completed"))
    project.status = "completed"
    db.flush()
    return article


def competitor_outline(page: CompetitorPage) -> str:
    lines = [f"# {page.topic}", "## Что важно знать"]
    for cluster in page.clusters[:5]:
        label = str(cluster["label"]).strip()
        if label and label.casefold() != page.topic.casefold():
            lines.append(f"## {label.capitalize()}")
    return "\n".join(lines)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def web_ui() -> str:
    return TEMPLATE_PATH.read_text(encoding="utf-8")


@app.post("/projects", status_code=status.HTTP_201_CREATED)
async def create_project(request: Request, db: Db):
    payload, keywords = await parse_create_request(request)
    project = Project(
        topic=payload.topic,
        competitor_url=str(payload.competitor_url) if payload.competitor_url else None,
        target_audience=payload.target_audience,
        writing_style=payload.writing_style,
        desired_length=payload.desired_length,
        main_keyword=payload.main_keyword,
        source_outline=payload.source_outline,
        metadata_json=payload.metadata,
        status="created",
    )
    db.add(project)
    db.flush()
    db.add_all(Keyword(project_id=project.id, phrase=phrase, source="input", status="imported") for phrase in keywords)
    db.commit()
    return project_payload(db, project)


@app.post("/one-click", status_code=status.HTTP_201_CREATED)
def one_click_article(
    body: OneClickRequest,
    db: Db,
    competitor_service: Annotated[CompetitorService, Depends(get_competitor_service)],
    traffic_service: Annotated[TrafficService, Depends(get_traffic_service)],
    llm_service: Annotated[LLMService, Depends(get_llm_service)],
):
    try:
        page = competitor_service.analyze(str(body.competitor_url), body.keyword_limit)
        project = Project(
            topic=page.topic,
            competitor_url=page.url,
            target_audience=body.target_audience.strip(),
            writing_style=body.writing_style.strip(),
            desired_length=body.desired_length,
            main_keyword=page.main_keyword,
            source_outline=competitor_outline(page),
            status="created",
            metadata_json={
                "workflow": "one-click",
                "competitor": {
                    "page_title": page.topic,
                    "description": page.description,
                    "headings": [{"level": level, "title": title} for level, title in page.headings],
                    "clusters": page.clusters,
                    "source_word_count": page.source_word_count,
                },
            },
        )
        db.add(project)
        db.flush()
        db.add_all(
            Keyword(
                project_id=project.id,
                phrase=phrase,
                source="competitor",
                status="imported",
                metadata_json={"origin": "competitor"},
            )
            for phrase in page.keywords
        )
        db.flush()
        apply_analysis(db, project, traffic_service)
        context = (
            "Семантические кластеры страницы конкурента: "
            + "; ".join(str(cluster["label"]) for cluster in page.clusters)
            + ". Используй только как ориентир по интенту. Не копируй формулировки или фрагменты исходной страницы."
        )
        create_generated_article(db, project, llm_service, body.use_mock, source_context=context)
        db.commit()
        return project_payload(db, project)
    except CompetitorAnalysisError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Ошибка one-click обработки сайта %s", body.competitor_url)
        raise HTTPException(status_code=502, detail=f"Не удалось обработать сайт конкурента: {exc}") from exc


@app.post("/projects/{project_id}/analyze")
async def analyze_project(
    project_id: int,
    request: Request,
    db: Db,
    traffic_service: Annotated[TrafficService, Depends(get_traffic_service)],
):
    project = get_project_or_404(db, project_id)
    uploaded = await optional_analysis_keywords(request)
    try:
        project.status = "analyzing"
        if uploaded:
            db.query(Keyword).filter_by(project_id=project.id).delete(synchronize_session=False)
            db.add_all(Keyword(project_id=project.id, phrase=phrase, source="input", status="imported") for phrase in uploaded)
            db.flush()
        existing = db.query(Keyword).filter_by(project_id=project.id).order_by(Keyword.id).all()
        phrases = normalize_keywords([keyword.phrase for keyword in existing])
        if not phrases and project.main_keyword:
            phrases = [project.main_keyword]
            db.add(Keyword(project_id=project.id, phrase=project.main_keyword, source="manual", status="imported"))
            db.flush()
            existing = db.query(Keyword).filter_by(project_id=project.id).all()
        if not phrases:
            raise HTTPException(status_code=422, detail="Добавьте хотя бы одно ключевое слово перед анализом.")
        metrics, warning = traffic_service.enrich(phrases)
        by_phrase = {keyword.phrase.casefold(): keyword for keyword in existing}
        for metric in metrics:
            keyword = by_phrase.get(metric.phrase.casefold())
            if keyword:
                keyword.frequency = metric.frequency
                keyword.traffic = metric.traffic
                keyword.source = metric.source
                keyword.metadata_json = metric.metadata
                keyword.status = "analyzed"
        best = max(metrics, key=lambda item: item.frequency)
        project.main_keyword = project.main_keyword or best.phrase
        db.query(OutlineItem).filter_by(project_id=project.id).delete(synchronize_session=False)
        nodes = build_outline(project.topic, project.source_outline, phrases)
        db.add_all(OutlineItem(project_id=project.id, level=node.level, title=node.title, position=node.position, status="ready") for node in nodes)
        project.status = "analyzed"
        project.metadata_json = {**(project.metadata_json or {}), "analysis_warning": warning}
        db.commit()
        return project_payload(db, project)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Ошибка анализа проекта %s", project_id)
        raise HTTPException(status_code=500, detail=f"Не удалось выполнить анализ: {exc}") from exc


@app.get("/projects/{project_id}")
def get_project(project_id: int, db: Db):
    return project_payload(db, get_project_or_404(db, project_id))


@app.post("/projects/{project_id}/generate-article")
def generate_article(
    project_id: int,
    body: GenerateArticleRequest,
    db: Db,
    llm_service: Annotated[LLMService, Depends(get_llm_service)],
):
    project = get_project_or_404(db, project_id)
    items = db.query(OutlineItem).filter_by(project_id=project.id).order_by(OutlineItem.position).all()
    if not items:
        raise HTTPException(status_code=409, detail="Сначала запустите анализ проекта, чтобы сформировать outline.")
    main_keyword = project.main_keyword or project.topic
    nodes = [OutlineNode(item.level, item.title, item.position) for item in items]
    prompt = llm_service.build_prompt(project.topic, main_keyword, nodes, project.target_audience, project.writing_style, project.desired_length)
    project.status = "generating"
    content, provider, warning = llm_service.generate(prompt, project.topic, main_keyword, nodes, body.use_mock)
    run = PromptRun(project_id=project.id, prompt=prompt, provider=provider, response_excerpt=content[:1000], error=warning, status="completed" if not warning else "fallback")
    article = Article(project_id=project.id, title=project.topic, content=content, model_name=provider, status="generated", metadata_json={"warning": warning})
    db.add_all([run, article])
    db.flush()
    keyword_phrases = [row.phrase for row in db.query(Keyword).filter_by(project_id=project.id).all()]
    result = score_article(content, main_keyword, keyword_phrases)
    db.add(ScoreResult(project_id=project.id, article_id=article.id, overall_score=result["overall_score"], result=result, status="completed"))
    project.status = "completed"
    db.commit()
    return project_payload(db, project)


@app.get("/projects/{project_id}/export")
def export_project(project_id: int, db: Db, export_format: Annotated[str, Query(alias="format", pattern="^(json|csv|xlsx)$")] = "json"):
    project = get_project_or_404(db, project_id)
    data, media_type, filename = build_export(project_payload(db, project), export_format)
    return Response(content=data, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})
