import type { ChecklistItem, WorkspaceData } from "@/types/board";

const now = new Date();
const isoIn = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const checklist = (taskId: string, items: Array<{ title: string; completed?: boolean; dueIn?: number }>): ChecklistItem[] => items.map((item, index) => ({
  id: `${taskId}-check-${index + 1}`,
  title: item.title,
  completed: item.completed ?? false,
  dueDate: item.dueIn === undefined ? undefined : isoIn(item.dueIn),
  createdAt: now.toISOString(),
}));

export const seedData: WorkspaceData = {
  activeBoardId: "board-product",
  boards: {
    "board-product": { id: "board-product", title: "Запуск продукта", description: "Единый план запуска новой версии продукта", color: "#6d5dfc", listIds: ["list-ideas", "list-progress", "list-review", "list-done"], createdAt: now.toISOString() },
    "board-marketing": { id: "board-marketing", title: "Маркетинг Q3", description: "Контент, кампании и аналитика", color: "#ec4899", listIds: ["list-marketing-plan", "list-marketing-live"], createdAt: now.toISOString() },
    "board-personal": { id: "board-personal", title: "Личные задачи", description: "Фокус и развитие", color: "#14b8a6", listIds: [], createdAt: now.toISOString() },
  },
  lists: {
    "list-ideas": { id: "list-ideas", title: "Идеи", taskIds: ["task-research", "task-copy"], collapsed: false, archived: false },
    "list-progress": { id: "list-progress", title: "В работе", taskIds: ["task-design", "task-api"], collapsed: false, archived: false },
    "list-review": { id: "list-review", title: "На проверке", taskIds: ["task-mobile"], collapsed: false, archived: false },
    "list-done": { id: "list-done", title: "Готово", taskIds: ["task-brand"], collapsed: false, archived: false },
    "list-marketing-plan": { id: "list-marketing-plan", title: "Запланировано", taskIds: ["task-campaign"], collapsed: false, archived: false },
    "list-marketing-live": { id: "list-marketing-live", title: "Запущено", taskIds: [], collapsed: false, archived: false },
  },
  employees: {
    "employee-anna": { id: "employee-anna", name: "Анна Смирнова", login: "admin", email: "anna@example.com", status: "active", role: "admin", canEditDeadlines: true, createdAt: now.toISOString() },
    "employee-mikhail": { id: "employee-mikhail", name: "Михаил Орлов", login: "mikhail@example.com", email: "mikhail@example.com", status: "active", role: "member", canEditDeadlines: true, createdAt: now.toISOString() },
    "employee-ekaterina": { id: "employee-ekaterina", name: "Екатерина Волкова", login: "ekaterina", status: "active", role: "member", canEditDeadlines: false, createdAt: now.toISOString() },
  },
  tasks: {
    "task-research": {
      id: "task-research", title: "Исследовать сценарии онбординга", checklist: checklist("task-research", [
        { title: "Собрать лучшие практики", completed: true },
        { title: "Провести 5 пользовательских интервью", dueIn: 1 },
        { title: "Подготовить краткий отчёт", dueIn: 2 },
      ]), priority: "high", status: "backlog", dueDate: isoIn(2), labels: ["Исследование", "UX"], assigneeIds: ["employee-anna"], comments: [], notes: "Проверить конкурентов перед интервью.", pinned: true, closed: false, archived: false, createdAt: now.toISOString(),
    },
    "task-copy": {
      id: "task-copy", title: "Подготовить тексты для релиза", checklist: checklist("task-copy", [
        { title: "Текст лендинга", dueIn: 3 },
        { title: "Changelog", dueIn: 5 },
        { title: "Письмо пользователям", dueIn: 6 },
      ]), priority: "medium", status: "backlog", dueDate: isoIn(6), labels: ["Контент"], assigneeIds: ["employee-ekaterina"], comments: [], notes: "", pinned: false, closed: false, archived: false, createdAt: now.toISOString(),
    },
    "task-design": {
      id: "task-design", title: "Финализировать дизайн-систему", checklist: checklist("task-design", [
        { title: "Закрыть состояния компонентов", completed: true },
        { title: "Проверить контрастность", dueIn: -1 },
        { title: "Обновить документацию", dueIn: 1 },
      ]), priority: "urgent", status: "in-progress", dueDate: isoIn(1), labels: ["Design", "UI"], assigneeIds: ["employee-anna", "employee-mikhail"], comments: [{ id: "c1", author: "Анна", text: "Добавила состояния hover и focus.", createdAt: now.toISOString() }], notes: "", pinned: true, closed: false, archived: false, createdAt: now.toISOString(),
    },
    "task-api": {
      id: "task-api", title: "Интеграция аналитики", checklist: checklist("task-api", [
        { title: "Событие signup", completed: true },
        { title: "Событие activation", dueIn: 2 },
        { title: "Проверить схему данных", dueIn: 4 },
      ]), priority: "high", status: "in-progress", dueDate: isoIn(4), labels: ["Разработка"], assigneeIds: ["employee-mikhail"], comments: [], notes: "События: signup, activation, invite.", pinned: false, closed: false, archived: false, createdAt: now.toISOString(),
    },
    "task-mobile": {
      id: "task-mobile", title: "QA мобильной версии", checklist: checklist("task-mobile", [
        { title: "Проверить iOS", completed: true },
        { title: "Проверить Android", dueIn: 0 },
      ]), priority: "medium", status: "review", dueDate: isoIn(0), labels: ["QA", "Mobile"], assigneeIds: ["employee-ekaterina"], comments: [], notes: "", pinned: false, closed: false, archived: false, createdAt: now.toISOString(),
    },
    "task-brand": {
      id: "task-brand", title: "Обновить бренд-ассеты", checklist: checklist("task-brand", [
        { title: "Экспортировать логотипы", completed: true, dueIn: -3 },
        { title: "Экспортировать иконки", completed: true, dueIn: -2 },
      ]), priority: "low", status: "done", dueDate: isoIn(-2), labels: ["Design"], assigneeIds: ["employee-anna"], comments: [], notes: "", pinned: false, closed: false, archived: false, createdAt: now.toISOString(),
    },
    "task-campaign": {
      id: "task-campaign", title: "Запустить ретаргетинг", checklist: checklist("task-campaign", [
        { title: "Подготовить аудитории", dueIn: 2 },
        { title: "Согласовать креативы", dueIn: 4 },
        { title: "Запустить кампанию", dueIn: 5 },
      ]), priority: "high", status: "backlog", dueDate: isoIn(5), labels: ["Performance"], assigneeIds: ["employee-mikhail"], comments: [], notes: "", pinned: false, closed: false, archived: false, createdAt: now.toISOString(),
    },
  },
};
