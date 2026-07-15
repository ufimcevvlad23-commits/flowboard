from __future__ import annotations

import re
from io import BytesIO, StringIO
from pathlib import Path

import pandas as pd


class KeywordFileError(ValueError):
    pass


def normalize_keywords(values: list[object]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for raw in values:
        if raw is None or pd.isna(raw):
            continue
        phrase = re.sub(r"\s+", " ", str(raw)).strip(" \t\r\n,;")
        key = phrase.casefold()
        if phrase and key not in seen:
            seen.add(key)
            result.append(phrase)
    return result


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise KeywordFileError("Не удалось определить кодировку файла. Используйте UTF-8 или Windows-1251.")


def read_keyword_file(filename: str, content: bytes) -> list[str]:
    suffix = Path(filename).suffix.lower()
    try:
        if suffix == ".txt":
            values = re.split(r"[\r\n;]+", _decode_text(content))
        elif suffix == ".csv":
            frame = pd.read_csv(StringIO(_decode_text(content)), sep=None, engine="python", header=None)
            values = frame.to_numpy().ravel().tolist()
        elif suffix == ".xlsx":
            frame = pd.read_excel(BytesIO(content), header=None)
            values = frame.to_numpy().ravel().tolist()
        else:
            raise KeywordFileError("Поддерживаются только файлы CSV, XLSX и TXT.")
    except KeywordFileError:
        raise
    except Exception as exc:
        raise KeywordFileError(f"Не удалось прочитать файл ключевых слов: {exc}") from exc
    return normalize_keywords(values)


def parse_keyword_text(text: str | None) -> list[str]:
    if not text:
        return []
    return normalize_keywords(re.split(r"[\r\n;,]+", text))
