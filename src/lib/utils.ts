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

export function pluralize(value: number, forms: [string, string, string]) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function employeeInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru") ?? "").join("");
}

export function employeeColor(id: string) {
  const colors = ["#7567ff", "#d85d82", "#3c9a82", "#d28b3c", "#397ec7", "#9a62c7"];
  const index = [...id].reduce((total, char) => total + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}
