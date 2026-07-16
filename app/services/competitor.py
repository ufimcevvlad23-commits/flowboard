from __future__ import annotations

import ipaddress
import math
import re
import socket
from collections import Counter
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import Settings
from app.services.keywords import normalize_keywords


class CompetitorAnalysisError(ValueError):
    pass


@dataclass
class CompetitorPage:
    url: str
    topic: str
    main_keyword: str
    keywords: list[str]
    clusters: list[dict[str, object]]
    headings: list[tuple[int, str]]
    description: str | None
    source_word_count: int


STOPWORDS = {
    "без", "более", "бы", "был", "была", "были", "было", "быть", "вам", "вас", "весь", "во", "вот",
    "все", "всего", "вы", "где", "для", "его", "ее", "если", "есть", "еще", "же", "за", "здесь",
    "из", "или", "как", "когда", "который", "ли", "мы", "на", "над", "наш", "не", "него", "нее",
    "нет", "но", "о", "об", "один", "он", "она", "они", "оно", "от", "по", "под", "при", "про",
    "с", "со", "так", "также", "там", "те", "тем", "то", "только", "у", "уже", "что", "чтобы", "эта",
    "эти", "это", "этот", "я", "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
    "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when", "with", "your",
}
TOKEN_RE = re.compile(r"[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9-]{1,}")


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _tokens(text: str) -> list[str]:
    return [token.casefold() for token in TOKEN_RE.findall(text) if len(token) > 2 and token.casefold() not in STOPWORDS]


def _public_host(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise CompetitorAnalysisError("Укажите полный публичный URL с http:// или https://.")
    if parsed.username or parsed.password:
        raise CompetitorAnalysisError("URL с логином или паролем не поддерживается.")
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)}
    except socket.gaierror as exc:
        raise CompetitorAnalysisError("Не удалось определить адрес сайта конкурента.") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise CompetitorAnalysisError("Разрешены только публичные сайты; локальные и служебные адреса запрещены.")


def _rank_phrases(title: str, headings: list[str], body: str, limit: int) -> list[str]:
    scores: Counter[str] = Counter()
    sources = [(title, 8), *( (heading, 5) for heading in headings ), (body, 1)]
    for text, weight in sources:
        tokens = _tokens(text)
        for size in (1, 2, 3):
            for index in range(len(tokens) - size + 1):
                phrase = " ".join(tokens[index:index + size])
                scores[phrase] += weight * size
    ranked = sorted(scores.items(), key=lambda item: (item[1] * math.log2(len(item[0]) + 2), len(item[0])), reverse=True)
    selected: list[str] = []
    for phrase, _ in ranked:
        phrase_tokens = set(phrase.split())
        if any(phrase_tokens == set(existing.split()) for existing in selected):
            continue
        if len(phrase_tokens) == 1 and any(phrase_tokens < set(existing.split()) for existing in selected[:8]):
            continue
        selected.append(phrase)
        if len(selected) >= limit:
            break
    return selected


def _cluster_keywords(keywords: list[str], max_clusters: int = 6) -> list[dict[str, object]]:
    clusters: list[dict[str, object]] = []
    for phrase in keywords:
        tokens = set(_tokens(phrase))
        if not tokens:
            continue
        best: dict[str, object] | None = None
        best_overlap = 0.0
        for cluster in clusters:
            cluster_tokens = set(cluster["tokens"])
            overlap = len(tokens & cluster_tokens) / max(1, len(tokens | cluster_tokens))
            if overlap > best_overlap:
                best, best_overlap = cluster, overlap
        if best is not None and best_overlap >= 0.25:
            best["phrases"].append(phrase)
            best["tokens"] = sorted(set(best["tokens"]) | tokens)
        elif len(clusters) < max_clusters:
            clusters.append({"label": phrase, "phrases": [phrase], "tokens": sorted(tokens)})
        else:
            clusters[-1]["phrases"].append(phrase)
    return [{"label": cluster["label"], "phrases": cluster["phrases"]} for cluster in clusters]


class CompetitorService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def analyze(self, url: str, keyword_limit: int = 20) -> CompetitorPage:
        html, final_url = self._fetch(url)
        soup = BeautifulSoup(html, "html.parser")
        for element in soup(["script", "style", "noscript", "svg", "form", "nav", "footer", "header", "aside"]):
            element.decompose()

        title = _clean_text(soup.title.get_text(" ", strip=True)) if soup.title else ""
        description_tag = soup.find("meta", attrs={"name": re.compile("^description$", re.I)})
        description = _clean_text(str(description_tag.get("content", ""))) if description_tag else None
        headings = []
        for element in soup.find_all(["h1", "h2", "h3"]):
            text = _clean_text(element.get_text(" ", strip=True))
            if text and len(text) <= 300:
                headings.append((int(element.name[1]), text))
        paragraphs = [_clean_text(element.get_text(" ", strip=True)) for element in soup.find_all(["p", "li"])]
        body = " ".join(value for value in paragraphs if len(value) >= 30)[:250_000]
        source_word_count = len(TOKEN_RE.findall(body))
        if not title and not headings:
            raise CompetitorAnalysisError("На странице не найдено заголовка или содержательного текста.")
        if source_word_count < 50:
            raise CompetitorAnalysisError("На странице слишком мало текста для извлечения семантики.")

        h1 = next((text for level, text in headings if level == 1), "")
        topic = (h1 or title).split("|")[0].split("—")[0].strip()[:500]
        ranked = _rank_phrases(" ".join(filter(None, [title, description or ""])), [text for _, text in headings], body, keyword_limit)
        main_keyword = ranked[0] if ranked else topic.casefold()
        keywords = normalize_keywords([main_keyword, *ranked])[:keyword_limit]
        return CompetitorPage(
            url=final_url,
            topic=topic,
            main_keyword=main_keyword,
            keywords=keywords,
            clusters=_cluster_keywords(keywords),
            headings=headings[:30],
            description=description,
            source_word_count=source_word_count,
        )

    def _fetch(self, url: str) -> tuple[str, str]:
        current = url
        headers = {"User-Agent": "SEOArticleFactory/1.0 (+content-analysis)", "Accept": "text/html,application/xhtml+xml"}
        with httpx.Client(timeout=self.settings.external_api_timeout, headers=headers, follow_redirects=False) as client:
            for _ in range(5):
                _public_host(current)
                with client.stream("GET", current) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location:
                            raise CompetitorAnalysisError("Сайт вернул редирект без адреса назначения.")
                        current = urljoin(current, location)
                        continue
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").casefold()
                    if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
                        raise CompetitorAnalysisError("URL должен вести на HTML-страницу.")
                    declared = int(response.headers.get("content-length", "0") or 0)
                    if declared > 2_000_000:
                        raise CompetitorAnalysisError("Страница слишком большая для анализа (максимум 2 МБ).")
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > 2_000_000:
                            raise CompetitorAnalysisError("Страница слишком большая для анализа (максимум 2 МБ).")
                    return bytes(content).decode(response.encoding or "utf-8", errors="replace"), str(response.url)
        raise CompetitorAnalysisError("Слишком много перенаправлений при загрузке сайта.")
