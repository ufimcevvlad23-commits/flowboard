from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class KeywordMetric:
    phrase: str
    frequency: int
    traffic: float
    source: str
    metadata: dict


class TrafficService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def enrich(self, phrases: list[str]) -> tuple[list[KeywordMetric], str | None]:
        if not phrases:
            return [], None
        if self.settings.keys_so_api_key:
            try:
                return self._keys_so(phrases), None
            except Exception as exc:
                logger.warning("Keys.so недоступен, используется mock: %s", exc)
                return self._mock(phrases), f"Keys.so недоступен: {exc}. Использован mock-режим."
        message = "KEYS_SO_API_KEY не задан. Использован детерминированный mock-режим."
        if self.settings.arsenkin_api_key:
            message += " ARSENKIN_API_KEY найден, но endpoint провайдера не настроен в MVP."
        return self._mock(phrases), message

    def _keys_so(self, phrases: list[str]) -> list[KeywordMetric]:
        headers = {"X-Keyso-TOKEN": self.settings.keys_so_api_key or ""}
        base_url = "https://api.keys.so"
        with httpx.Client(timeout=self.settings.external_api_timeout, headers=headers) as client:
            created = client.post(
                f"{base_url}/tools/keywords_by_list",
                json={"base": self.settings.keys_so_database, "list": phrases[:1000]},
            )
            created.raise_for_status()
            uid = created.json().get("uid")
            if not uid:
                raise RuntimeError("Keys.so не вернул uid отчёта")
            response = client.get(
                f"{base_url}/tools/keywords_by_list/{uid}",
                params={"base": self.settings.keys_so_database, "page": 1, "per_page": min(len(phrases), 1000)},
            )
            if response.status_code == 202:
                raise RuntimeError("отчёт Keys.so ещё обрабатывается; повторите анализ позже")
            response.raise_for_status()
            rows = {str(row.get("word", "")).casefold(): row for row in response.json().get("data", [])}
        metrics = []
        for phrase in phrases:
            row = rows.get(phrase.casefold(), {})
            frequency = int(row.get("wsk") or row.get("ws") or 0)
            metrics.append(KeywordMetric(phrase, frequency, round(frequency * 0.12, 2), "keys.so", row))
        return metrics

    @staticmethod
    def _mock(phrases: list[str]) -> list[KeywordMetric]:
        metrics = []
        for phrase in phrases:
            digest = int(hashlib.sha256(phrase.casefold().encode("utf-8")).hexdigest()[:8], 16)
            frequency = 10 + digest % 4991
            metrics.append(KeywordMetric(phrase, frequency, round(frequency * (0.08 + digest % 9 / 100), 2), "mock", {"synthetic": True}))
        return metrics
