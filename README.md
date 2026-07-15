# Flowboard

## SEO Article Factory MVP (FastAPI)

В репозитории также находится локальный Python-сервис для подготовки SEO-статей. Он импортирует ключи из JSON, CSV, XLSX или TXT, строит outline, генерирует Markdown-статью через OpenAI-compatible API, оценивает её по 20-балльной шкале и экспортирует весь проект в JSON, CSV или XLSX.

### Запуск

Требуется Python 3.11+.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Рабочая HTML-форма будет доступна на `http://127.0.0.1:8000/`, Swagger UI — на `http://127.0.0.1:8000/docs`, проверка состояния — на `http://127.0.0.1:8000/health`.

### Настройка

Сервис читает настройки только из переменных окружения; `.env` загружает `python-dotenv`. Для локального MVP достаточно значений из `.env.example`. Если `LLM_API_KEY` отсутствует или провайдер недоступен, генерация возвращает понятное предупреждение и рабочую mock-статью. Если `KEYS_SO_API_KEY` отсутствует либо Keys.so не отвечает, частотность и трафик рассчитываются детерминированно в mock-режиме. `ARSENKIN_API_KEY` зарезервирован для следующего адаптера: универсальный endpoint провайдера в MVP не предполагается.

Поддерживаемые переменные: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `KEYS_SO_API_KEY`, `ARSENKIN_API_KEY`, `APP_ENV`, `DATABASE_URL`. Дополнительно доступны `EXTERNAL_API_TIMEOUT` и `KEYS_SO_DATABASE`.

### API-сценарий

1. `POST /projects` — JSON или multipart. Поля: `topic`, `competitor_url`, `keywords`, `keyword_text`, `keyword_file`, `main_keyword`, `source_outline`, `target_audience`, `writing_style`, `desired_length`.
2. `POST /projects/{id}/analyze` — анализ уже сохранённых ключей; опционально принимает новый файл или список в тех же форматах.
3. `GET /projects/{id}` — проект вместе с ключами, outline, статьями, оценками и запусками промптов.
4. `POST /projects/{id}/generate-article` — тело `{"use_mock": false}`; сначала необходимо выполнить анализ.
5. `GET /projects/{id}/export?format=json|csv|xlsx` — выгрузка результата.

Пример создания через JSON:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/projects -ContentType application/json -Body '{"topic":"Автоматизация SEO","keywords":["seo автоматизация","генерация seo статей"],"desired_length":1200}'
```

Пример загрузки файла:

```bash
curl -X POST http://127.0.0.1:8000/projects -F "topic=Автоматизация SEO" -F "keyword_file=@keywords.xlsx"
```

Проверки:

```powershell
pytest -q
```

### Допущения MVP

- таблицы SQLite создаются автоматически при старте; Alembic оставлен за рамками MVP;
- запрос Keys.so создаётся через массовую проверку списка и читается один раз; если асинхронный отчёт ещё не готов, применяется graceful fallback;
- scoring основан на прозрачных локальных эвристиках и всегда возвращает JSON заданной структуры; это базовая проверка, а не замена редакторской экспертизы;
- экспорт CSV хранит разные типы сущностей строками с полями `record_type` и `data`, а XLSX — на отдельных листах.

### Деплой FastAPI на Vercel

Для production сервис разворачивается как отдельный Vercel-проект, а не внутри проекта Next.js `flowboard`. Vercel автоматически распознаёт `app/main.py` как FastAPI entrypoint. В production обязательно задайте `DATABASE_URL` на постоянную PostgreSQL/Neon-базу: локальная SQLite подходит только для разработки, поскольку файловая система serverless-функции не является постоянным хранилищем.

```powershell
Copy-Item pyproject.vercel.toml pyproject.toml
vercel link
vercel env add DATABASE_URL production
vercel --prod
```

`pyproject.vercel.toml` содержит явный FastAPI entrypoint и production-зависимости. При отдельном деплое скопируйте его как `pyproject.toml`; отдельное имя не позволяет Vercel-проекту Flowboard ошибочно определить Python как основной framework. Драйвер `psycopg` подключён в `requirements.txt`; адреса `postgres://` и `postgresql://` автоматически нормализуются для SQLAlchemy/psycopg 3.

Production-ready канбан-приложение для управления проектами, списками и задачами. Рабочее пространство защищено серверной авторизацией и хранится в Neon Postgres.

## Возможности

- создание, редактирование и удаление досок, списков и задач;
- drag-and-drop списков и карточек, перенос между колонками;
- чек-листы внутри задач: добавление, редактирование, удаление и отметка выполнения;
- отдельный дедлайн для каждого пункта и заметное состояние просрочки;
- сотрудники с именем и email или логином;
- создание учётных записей и удаление сотрудников администратором;
- роли «Администратор», «Пользователь» и «Гость» с отдельной вкладкой управления правами;
- отдельное разрешение на изменение дедлайнов для пользователей;
- немедленный отзыв всех сессий и блокировка входа после удаления сотрудника;
- назначение нескольких активных сотрудников ответственными;
- сворачивание колонок, ручное закрытие и повторное открытие задач;
- приоритеты, статусы, дедлайны задач, метки, заметки и комментарии;
- поиск, фильтры, сортировка, архив, экспорт и адаптивный интерфейс.
- автоматическое сохранение всех изменений в карточке задачи без отдельной кнопки;
- календарь и модальные окна, которые адаптируются к ширине и высоте viewport.

Поле описания у задач отсутствует. Поиск учитывает названия задач и пунктов чек-листа.

## Безопасность

- рабочие данные не сохраняются в `localStorage` и выдаются только после серверной проверки сессии;
- сессия хранится в `HttpOnly`, `SameSite=Lax`, `Secure` cookie, в базе сохраняется только SHA-256-хеш токена;
- пароли хешируются через `scrypt` с индивидуальной случайной солью;
- каждое API-чтение и изменение повторно проверяет активный статус сотрудника;
- создание, удаление учётных записей и выдача прав разрешены только администратору;
- гостевые сессии могут только читать доски и задачи, а запрет на дедлайны дополнительно проверяется сервером;
- после пяти неудачных попыток вход блокируется на 15 минут;
- изменяющие запросы проверяют `Origin`, ответы с персональными данными не кешируются;
- включены защитные HTTP-заголовки против clickjacking и MIME-sniffing.

## Стек

- Next.js 16 App Router, React 19, TypeScript;
- Neon Postgres через `@neondatabase/serverless`;
- Zustand как клиентское состояние с синхронизацией через защищённый API;
- Tailwind CSS 4 и собственная token-based дизайн-система;
- dnd-kit, Lucide React, date-fns, Sonner.

## Локальный запуск

Требуется Node.js 20.9+ и подключённая база Neon.

```bash
npm install
vercel env pull .env.local --yes
npm run db:migrate
npm run db:seed
npm run dev
```

При первом `db:seed` создаются тестовые учётные записи. Пароли записываются только в локальный файл `.flowboard-admin-credentials.txt`, исключённый из Git.

Production-проверка:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Структура

```text
scripts/                 миграция схемы и безопасное начальное заполнение
src/
  app/api/               защищённые маршруты авторизации, сотрудников и данных
  components/board/      доска, карточки, чек-листы и сотрудники
  components/auth/       форма входа
  lib/                   DAL, сессии, БД, валидация и seed-данные
  store/                 клиентское состояние и синхронизация с API
  types/                 доменная модель
```

## Публикация

- GitHub: [github.com/ufimcevvlad23-commits/flowboard](https://github.com/ufimcevvlad23-commits/flowboard)
- Production: [flowboard-three-rosy.vercel.app](https://flowboard-three-rosy.vercel.app)
