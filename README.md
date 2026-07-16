# SEO Article Factory

FastAPI-сервис для подготовки SEO-статей. Он импортирует ключевые слова из JSON, CSV, XLSX или TXT, строит структуру статьи, генерирует Markdown через OpenAI-compatible API, оценивает результат по 20-балльной шкале и экспортирует проект в JSON, CSV или XLSX.

## Локальный запуск

Требуется Python 3.11+.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Интерфейс доступен на `http://127.0.0.1:8000/`, Swagger UI — на `http://127.0.0.1:8000/docs`, проверка состояния — на `http://127.0.0.1:8000/health`.

## Настройка

Сервис использует переменные окружения из `.env`. Без `LLM_API_KEY` генерация работает в mock-режиме. Без `KEYS_SO_API_KEY` частотность и трафик рассчитываются детерминированно.

Основные переменные:

- `DATABASE_URL`;
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`;
- `KEYS_SO_API_KEY`, `KEYS_SO_DATABASE`;
- `ARSENKIN_API_KEY`;
- `APP_ENV`, `EXTERNAL_API_TIMEOUT`.

## API

- `POST /one-click` — принять только `competitor_url`, автоматически извлечь тему и ключевые кластеры, построить outline, сгенерировать и оценить готовую статью;
- `POST /projects` — создать проект и загрузить ключевые слова;
- `POST /projects/{id}/analyze` — проанализировать ключи;
- `GET /projects/{id}` — получить проект;
- `POST /projects/{id}/generate-article` — сгенерировать статью;
- `GET /projects/{id}/export?format=json|csv|xlsx` — экспортировать результат.

## Проверка

```powershell
pytest -q
```

## Деплой на Vercel

Для production задайте постоянный `DATABASE_URL` PostgreSQL/Neon. Локальная SQLite подходит только для разработки.

```powershell
vercel link
vercel env add DATABASE_URL production
vercel --prod
```

`pyproject.toml` содержит FastAPI entrypoint и production-зависимости, а `vercel.json` выбирает FastAPI framework preset.
