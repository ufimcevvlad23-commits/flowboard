import clsx, { type ClassValue } from "clsx";
import type { Priority, TaskStatus } from "@/types/board";

export const cn = (...values: ClassValue[]) => clsx(values);
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const priorityMeta: Record<Priority, { label: string; color: string }> = {
  low: { label: "Низкий", color: "var(--priority-low)" },
  medium: { label: "Средний", color: "var(--priority-medium)" },
  high: { label: "Высокий", color: "var(--priority-high)" },
  urgent: { label: "Срочный", color: "var(--priority-urgent)" },
};
export const statusMeta: Record<TaskStatus, string> = {
  backlog: "Бэклог",
  "in-progress": "В работе",
  review: "На проверке",
  done: "Готово",
};
