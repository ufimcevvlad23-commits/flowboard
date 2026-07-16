from __future__ import annotations

import logging

import httpx

from app.config import Settings
from app.services.outline import OutlineNode

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def build_prompt(
        topic: str,
        main_keyword: str,
        outline: list[OutlineNode],
        audience: str,
        style: str,
        desired_length: int,
        source_context: str | None = None,
    ) -> str:
        structure = "\n".join(f"{'#' * item.level} {item.title}" for item in outline)
        context = f"\nКонтекст исследования: {source_context}" if source_context else ""
        return f"""Напиши полезную SEO-статью на русском языке.
Тема: {topic}
Главный ключ: {main_keyword}
Целевая аудитория: {audience}
Стиль: {style}
Желаемая длина: около {desired_length} слов.
Структура:
{structure}
{context}

Требования: сохрани иерархию Markdown, используй короткие абзацы и списки, раскрой интент без воды, добавь конкретные шаги, FAQ и естественный CTA. Не выдумывай факты и источники."""

    def generate(self, prompt: str, topic: str, main_keyword: str, outline: list[OutlineNode], use_mock: bool = False) -> tuple[str, str, str | None]:
        if use_mock or not self.settings.llm_enabled:
            reason = "LLM_API_KEY не задан; использован mock-ответ." if not self.settings.llm_enabled else "Mock-режим запрошен явно."
            return self._mock(topic, main_keyword, outline), "mock", reason
        try:
            url = f"{self.settings.llm_base_url.rstrip('/')}/chat/completions"
            response = httpx.post(
                url,
                headers={"Authorization": f"Bearer {self.settings.llm_api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.settings.llm_model,
                    "messages": [
                        {"role": "system", "content": "Ты опытный SEO-редактор. Возвращай только готовую статью в Markdown."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.4,
                },
                timeout=90,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            if not content:
                raise RuntimeError("LLM вернул пустой ответ")
            return content, self.settings.llm_model, None
        except Exception as exc:
            logger.exception("Ошибка LLM")
            return self._mock(topic, main_keyword, outline), "mock", f"LLM недоступна: {exc}. Использован mock-ответ."

    @staticmethod
    def _mock(topic: str, main_keyword: str, outline: list[OutlineNode]) -> str:
        blocks = []
        for item in outline:
            heading = f"{'#' * item.level} {item.title}"
            if item.level == 1:
                body = f"{main_keyword.capitalize()} — центральная тема этого практического материала. Разберём {topic.lower()} последовательно и без лишней теории."
            elif "faq" in item.title.casefold() or "вопрос" in item.title.casefold():
                body = f"### С чего начать?\nНачните с цели, исходных данных и измеримого результата.\n\n### Как оценить результат?\nСравните итог с требованиями и скорректируйте слабые места."
            elif "следующ" in item.title.casefold() or "cta" in item.title.casefold():
                body = "Составьте короткий план внедрения и выполните первый шаг сегодня. Если нужна помощь, запросите консультацию специалиста."
            else:
                body = f"В разделе раскрывается «{item.title}».\n\n- определите исходные условия;\n- выполните шаги по порядку;\n- проверьте результат по понятным критериям.\n\nТакой подход помогает применить рекомендации на практике и избежать типичных ошибок."
            blocks.append(f"{heading}\n\n{body}")
        return "\n\n".join(blocks)
