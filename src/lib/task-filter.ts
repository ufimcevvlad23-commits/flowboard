import type { Filters, Task } from "@/types/board";

export type TaskSort = "manual" | "due" | "priority" | "title";

export function taskMatches(task: Task, search: string, filters: Filters, listTitle = "") {
  if (task.archived) return false;

  const normalizedSearch = search.trim().toLocaleLowerCase("ru");
  const haystack = `${task.title} ${task.description} ${task.labels.join(" ")} ${listTitle}`.toLocaleLowerCase("ru");
  if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
  if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
  if (filters.statuses.length && !filters.statuses.includes(task.status)) return false;
  if (filters.label && !task.labels.includes(filters.label)) return false;

  if (filters.due !== "all") {
    if (!task.dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${task.dueDate}T00:00:00`);
    const week = new Date(today);
    week.setDate(week.getDate() + 7);
    if (filters.due === "overdue" && due >= today) return false;
    if (filters.due === "today" && due.getTime() !== today.getTime()) return false;
    if (filters.due === "week" && (due < today || due > week)) return false;
  }

  return true;
}

export function sortTasks(items: Task[], sort: TaskSort) {
  const active = items.filter((task) => !task.closed);
  const closed = items.filter((task) => task.closed);
  if (sort === "manual") return [...active, ...closed];
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortGroup = (group: Task[]) => [...group].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "ru");
    if (sort === "priority") return priorityOrder[a.priority] - priorityOrder[b.priority];
    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });
  return [...sortGroup(active), ...sortGroup(closed)];
}
