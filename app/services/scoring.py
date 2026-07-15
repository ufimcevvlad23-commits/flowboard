from __future__ import annotations

import re


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-zА-Яа-яЁё0-9-]+", text)


def score_article(text: str, main_keyword: str, keywords: list[str]) -> dict:
    words = _words(text)
    word_count = len(words)
    lower = text.casefold()
    headings = re.findall(r"^(#{1,3})\s+(.+)$", text, flags=re.MULTILINE)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip() and not p.lstrip().startswith("#")]
    list_items = re.findall(r"^\s*(?:[-*]|\d+[.)])\s+", text, flags=re.MULTILINE)
    heading_text = " ".join(title for _, title in headings).casefold()
    main_count = lower.count(main_keyword.casefold()) if main_keyword else 0
    density = main_count / max(word_count, 1) * 100
    promotion_keywords = [keyword for keyword in keywords if keyword.casefold() in lower]

    structure = 0
    structure += int(any(len(marker) == 1 for marker, _ in headings))
    structure += int(len(headings) >= 3 and any(len(marker) >= 2 for marker, _ in headings))
    structure += int(len(list_items) >= 3)
    structure += int(bool(paragraphs) and sum(len(_words(p)) <= 80 for p in paragraphs) / len(paragraphs) >= 0.7)

    seo = 0
    seo += int(bool(main_keyword) and main_keyword.casefold() in lower[:500])
    seo += int(bool(main_keyword) and main_keyword.casefold() in heading_text)
    seo += int(main_count > 0 and density <= 3.0)
    seo += int(len(promotion_keywords) >= min(2, max(1, len(keywords))))

    content = 0
    content += int(word_count >= 250)
    content += int(bool(re.search(r"\b(?:шаг|пример|рекомендац|проверь|определите|сравните)\w*", lower)))
    content += int(bool(re.search(r"\d", text)) or len(list_items) >= 3)
    content += int(bool(re.search(r"\b(?:помог|польз|результат|эффект|выгод)\w*", lower)))
    content += int("?" in text or "faq" in lower or "частые вопросы" in lower)

    conversion = 0
    conversion += int(bool(re.search(r"\b(?:оставьте|закажите|запишитесь|свяжитесь|начните|получите|консультац)\w*", lower)))
    conversion += int(bool(re.search(r"\b(?:преимуществ|выгод|помогает|без|эконом)\w*", lower)))
    conversion += int(bool(re.search(r"\[[^]]+\]\([^)]+\)", text)) or "связанные материалы" in lower)

    long_sentences = [s for s in re.split(r"[.!?]+", text) if len(_words(s)) > 30]
    bureaucracy = re.findall(r"\b(?:осуществляется|данный|вышеуказанный|в целях|посредством)\b", lower)
    style = 0
    style += int(not bureaucracy)
    style += int(len(long_sentences) <= max(1, word_count // 250))
    style += int(bool(paragraphs) and sum(len(_words(p)) <= 60 for p in paragraphs) / len(paragraphs) >= 0.6)
    style += int(len(set(word.casefold() for word in words)) / max(word_count, 1) >= 0.25)

    scores = {"structure": structure, "seo": seo, "content": content, "conversion": conversion, "style": style}
    critical_errors = []
    if not headings:
        critical_errors.append("Нет Markdown-заголовков H1–H3.")
    if main_count == 0:
        critical_errors.append("Главный ключ не найден в статье.")
    if density > 3.0:
        critical_errors.append(f"Возможный переспам: плотность главного ключа {density:.1f}%.")
    if word_count < 250:
        critical_errors.append("Текст слишком короткий для полноценного раскрытия темы.")

    recommendations = []
    if structure < 4:
        recommendations.append("Улучшите иерархию H1–H3, добавьте список и сократите длинные абзацы.")
    if seo < 4:
        recommendations.append("Добавьте главный ключ в начало и заголовки, используйте связанные фразы естественно.")
    if content < 4:
        recommendations.append("Добавьте конкретные шаги, примеры, факты и ответы на вопросы аудитории.")
    if conversion < 3:
        recommendations.append("Усильте пользу, CTA и добавьте ссылку на связанный материал.")
    if style < 4:
        recommendations.append("Уберите канцеляризмы и сократите длинные предложения и абзацы.")

    return {
        "word_count": word_count,
        "promotion_keywords": promotion_keywords,
        "overall_score": sum(scores.values()),
        "scores": scores,
        "detailed_breakdown": {
            "structure": f"{structure}/4: заголовков {len(headings)}, элементов списков {len(list_items)}.",
            "seo": f"{seo}/4: главный ключ использован {main_count} раз, плотность {density:.2f}%.",
            "content": f"{content}/5: оценены полнота, конкретика, примеры, польза и ответы на вопросы.",
            "conversion": f"{conversion}/3: оценены CTA, ценностное предложение и перелинковка.",
            "style": f"{style}/4: длинных предложений {len(long_sentences)}, канцеляризмов {len(bureaucracy)}.",
        },
        "critical_errors": critical_errors,
        "recommendations": recommendations,
    }
