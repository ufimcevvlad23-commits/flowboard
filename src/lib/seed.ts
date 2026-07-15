import type { WorkspaceData } from "@/types/board";

const now = new Date();
const isoIn = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
export const seedData: WorkspaceData = {
  activeBoardId: "board-product",
  boards: {
    "board-product": {
      id: "board-product",
      title: "Запуск продукта",
      description: "Единый план запуска новой версии продукта",
      color: "#6d5dfc",
      listIds: ["list-ideas", "list-progress", "list-review", "list-done"],
      createdAt: now.toISOString(),
    },
    "board-marketing": {
      id: "board-marketing",
      title: "Маркетинг Q3",
      description: "Контент, кампании и аналитика",
      color: "#ec4899",
      listIds: ["list-marketing-plan", "list-marketing-live"],
      createdAt: now.toISOString(),
    },
    "board-personal": {
      id: "board-personal",
      title: "Личные задачи",
      description: "Фокус и развитие",
      color: "#14b8a6",
      listIds: [],
      createdAt: now.toISOString(),
    },
  },
  lists: {
    "list-ideas": { id: "list-ideas", title: "Идеи", taskIds: ["task-research", "task-copy"], archived: false },
    "list-progress": { id: "list-progress", title: "В работе", taskIds: ["task-design", "task-api"], archived: false },
    "list-review": { id: "list-review", title: "На проверке", taskIds: ["task-mobile"], archived: false },
    "list-done": { id: "list-done", title: "Готово", taskIds: ["task-brand"], archived: false },
    "list-marketing-plan": { id: "list-marketing-plan", title: "Запланировано", taskIds: ["task-campaign"], archived: false },
    "list-marketing-live": { id: "list-marketing-live", title: "Запущено", taskIds: [], archived: false },
  },
  tasks: {
    "task-research": {
      id: "task-research", title: "Исследовать сценарии онбординга", description: "Собрать лучшие практики и подготовить краткий отчёт для команды.", priority: "high", status: "backlog", dueDate: isoIn(2), labels: ["Исследование", "UX"], comments: [], notes: "Проверить конкурентов и 5 пользовательских интервью.", pinned: true, archived: false, createdAt: now.toISOString(),
    },
    "task-copy": {
      id: "task-copy", title: "Подготовить тексты для релиза", description: "Лендинг, changelog и письмо пользователям.", priority: "medium", status: "backlog", dueDate: isoIn(6), labels: ["Контент"], comments: [], notes: "", pinned: false, archived: false, createdAt: now.toISOString(),
    },
    "task-design": {
      id: "task-design", title: "Финализировать дизайн-систему", description: "Закрыть состояния компонентов и проверить контрастность.", priority: "urgent", status: "in-progress", dueDate: isoIn(1), labels: ["Design", "UI"], comments: [{ id: "c1", author: "Анна", text: "Добавила состояния hover и focus.", createdAt: now.toISOString() }], notes: "", pinned: true, archived: false, createdAt: now.toISOString(),
    },
    "task-api": {
      id: "task-api", title: "Интеграция аналитики", description: "Добавить ключевые события воронки и проверить схему данных.", priority: "high", status: "in-progress", dueDate: isoIn(4), labels: ["Разработка"], comments: [], notes: "События: signup, activation, invite.", pinned: false, archived: false, createdAt: now.toISOString(),
    },
    "task-mobile": {
      id: "task-mobile", title: "QA мобильной версии", description: "Проверить основные сценарии на iOS и Android.", priority: "medium", status: "review", dueDate: isoIn(0), labels: ["QA", "Mobile"], comments: [], notes: "", pinned: false, archived: false, createdAt: now.toISOString(),
    },
    "task-brand": {
      id: "task-brand", title: "Обновить бренд-ассеты", description: "Экспортировать финальные логотипы и иконки.", priority: "low", status: "done", dueDate: isoIn(-2), labels: ["Design"], comments: [], notes: "", pinned: false, archived: false, createdAt: now.toISOString(),
    },
    "task-campaign": {
      id: "task-campaign", title: "Запустить ретаргетинг", description: "Подготовить аудитории и креативы.", priority: "high", status: "backlog", dueDate: isoIn(5), labels: ["Performance"], comments: [], notes: "", pinned: false, archived: false, createdAt: now.toISOString(),
    },
  },
};
