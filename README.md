# Flowboard

Production-ready канбан-приложение для управления проектами, списками и задачами. Интерфейс построен вокруг быстрой ежедневной работы: drag-and-drop, быстрые действия, детальные карточки, поиск, фильтры, сортировка, архив и статистика.

## Возможности

- создание, редактирование и удаление досок, списков и задач;
- drag-and-drop списков и карточек, включая перенос между колонками;
- приоритеты, статусы, дедлайны, метки, заметки и комментарии;
- поиск по задачам и спискам, фильтрация по статусу/приоритету/сроку/метке и сортировка;
- закрепление задач, архивирование и восстановление;
- переключение между канбан-доской и табличным списком;
- экспорт всего рабочего пространства в JSON-резервную копию;
- светлая и тёмная темы, компактный режим;
- адаптивный desktop/tablet/mobile интерфейс;
- локальное сохранение Zustand Persist — данные остаются после перезагрузки;
- loading, error, empty и success-состояния, toast-уведомления;
- клавиатурная навигация и быстрый поиск по `Ctrl/⌘ + K`.

## Стек

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4 и собственная token-based дизайн-система
- Zustand Persist
- dnd-kit
- Lucide React, date-fns, Sonner

## Запуск

Требуется Node.js 20.9+.

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Production-проверка:

```bash
npm run lint
npm run build
npm run start
```

## Структура

```text
src/
  app/                 App Router, metadata и системные состояния
  components/
    board/             доска, списки, карточки и модальные окна
    layout/            sidebar и верхняя панель
    ui/                переиспользуемые UI-примитивы
  lib/                 seed-данные и утилиты
  store/               Zustand store и persistence
  types/               доменная модель
```

## Хранение данных

MVP работает без внешних ключей: рабочее пространство хранится в `localStorage` под ключом `flowboard-workspace-v1`. Архитектура store отделена от UI и готова к замене persistence-слоя на API/Supabase.

## Публикация

- GitHub: [github.com/ufimcevvlad23-commits/flowboard](https://github.com/ufimcevvlad23-commits/flowboard)
- Production: [flowboard-three-rosy.vercel.app](https://flowboard-three-rosy.vercel.app)
