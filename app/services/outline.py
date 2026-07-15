from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class OutlineNode:
    level: int
    title: str
    position: int


def build_outline(topic: str, source_outline: str | None, keywords: list[str]) -> list[OutlineNode]:
    titles: list[tuple[int, str]] = []
    if source_outline:
        for line in source_outline.splitlines():
            cleaned = line.strip().lstrip("-*• ")
            if not cleaned:
                continue
            markdown = re.match(r"^(#{1,3})\s+(.+)$", cleaned)
            numbered = re.match(r"^(H[1-3])[:.\s-]+(.+)$", cleaned, flags=re.IGNORECASE)
            if markdown:
                titles.append((len(markdown.group(1)), markdown.group(2).strip()))
            elif numbered:
                titles.append((int(numbered.group(1)[1]), numbered.group(2).strip()))
            else:
                titles.append((2, cleaned))
    if not titles:
        secondary = keywords[1:4]
        titles = [(1, topic), (2, "Введение и ключевые выводы")]
        titles.extend((2, f"Что важно знать: {keyword}") for keyword in secondary)
        titles.extend([(2, "Практические рекомендации"), (2, "Частые вопросы"), (2, "Следующий шаг"), (2, "Заключение")])
    else:
        if not any(level == 1 for level, _ in titles):
            titles.insert(0, (1, topic))
        existing = " ".join(title.casefold() for _, title in titles)
        defaults = [
            (2, "Введение"),
            (2, "Практические рекомендации"),
            (2, "FAQ"),
            (2, "Следующий шаг"),
            (2, "Заключение"),
        ]
        aliases = ["введ", "практи", "faq", "следующ", "заключ"]
        for item, alias in zip(defaults, aliases):
            if alias not in existing:
                titles.append(item)
    return [OutlineNode(level, title, position) for position, (level, title) in enumerate(titles, 1)]
