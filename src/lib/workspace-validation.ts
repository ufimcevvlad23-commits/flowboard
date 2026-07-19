import "server-only";

import type { ChecklistItem, CommentAttachment, Task, WorkspaceData } from "@/types/board";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.length <= max ? value : null;
}

function optionalDate(value: unknown) {
  return value === undefined || value === null || value === "" ? undefined : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function checklistItem(value: unknown): ChecklistItem | null {
  if (!record(value)) return null;
  const id = text(value.id, 120);
  const title = text(value.title, 500)?.trim();
  const dueDate = optionalDate(value.dueDate);
  const createdAt = text(value.createdAt, 64);
  if (!id || !title || dueDate === null || !createdAt || typeof value.completed !== "boolean") return null;
  return { id, title, completed: value.completed, dueDate, createdAt };
}

function commentAttachment(value: unknown): CommentAttachment | null {
  if (!record(value)) return null;
  const id = text(value.id, 120);
  const name = text(value.name, 180)?.trim();
  const type = value.type;
  const dataUrl = text(value.dataUrl, 3_000_000);
  const size = typeof value.size === "number" && Number.isInteger(value.size) ? value.size : -1;
  if (!id || !name || (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp") || !dataUrl || size < 0 || size > 2_000_000) return null;
  const expectedPrefix = `data:${type};base64,`;
  if (!dataUrl.startsWith(expectedPrefix) || !/^[A-Za-z0-9+/=]+$/.test(dataUrl.slice(expectedPrefix.length))) return null;
  return { id, name, type, dataUrl, size };
}

export function sanitizeWorkspacePayload(value: unknown): Omit<WorkspaceData, "employees"> | null {
  if (!record(value) || !record(value.boards) || !record(value.lists) || !record(value.tasks)) return null;
  const activeBoardId = text(value.activeBoardId, 120);
  if (activeBoardId === null) return null;

  const boards: WorkspaceData["boards"] = {};
  for (const [id, raw] of Object.entries(value.boards)) {
    if (!record(raw) || id.length > 120) return null;
    const title = text(raw.title, 200)?.trim();
    const description = text(raw.description, 500) ?? "";
    const color = text(raw.color, 32);
    const createdAt = text(raw.createdAt, 64);
    if (!title || !color || !createdAt || !Array.isArray(raw.listIds) || raw.listIds.some((item) => typeof item !== "string" || item.length > 120)) return null;
    boards[id] = { id, title, description, color, listIds: raw.listIds, createdAt };
  }

  const lists: WorkspaceData["lists"] = {};
  for (const [id, raw] of Object.entries(value.lists)) {
    if (!record(raw) || id.length > 120) return null;
    const title = text(raw.title, 200)?.trim();
    if (!title || !Array.isArray(raw.taskIds) || raw.taskIds.some((item) => typeof item !== "string" || item.length > 120) || typeof raw.collapsed !== "boolean" || typeof raw.archived !== "boolean") return null;
    lists[id] = { id, title, taskIds: raw.taskIds, collapsed: raw.collapsed, archived: raw.archived };
  }

  const tasks: WorkspaceData["tasks"] = {};
  for (const [id, raw] of Object.entries(value.tasks)) {
    if (!record(raw) || id.length > 120) return null;
    const title = text(raw.title, 5000)?.trim();
    const dueDate = optionalDate(raw.dueDate);
    const createdAt = text(raw.createdAt, 64);
    if (!title || dueDate === null || !createdAt || !Array.isArray(raw.checklist) || raw.checklist.length > 200 || !Array.isArray(raw.labels) || !Array.isArray(raw.assigneeIds) || !Array.isArray(raw.comments)) return null;
    const normalizedChecklist = raw.checklist.map(checklistItem);
    if (normalizedChecklist.some((item) => !item)) return null;
    if (raw.labels.some((item) => typeof item !== "string" || item.length > 80) || raw.assigneeIds.some((item) => typeof item !== "string" || item.length > 120)) return null;
    if (!["low", "medium", "high", "urgent"].includes(String(raw.priority)) || !["backlog", "in-progress", "review", "done"].includes(String(raw.status))) return null;
    if ([raw.closed, raw.archived].some((item) => typeof item !== "boolean")) return null;
    const comments = raw.comments.flatMap((comment) => {
      if (!record(comment)) return [];
      const commentId = text(comment.id, 120);
      const author = text(comment.author, 120)?.trim();
      const commentText = text(comment.text, 3000)?.trim();
      const commentCreatedAt = text(comment.createdAt, 64);
      const mentionIds = Array.isArray(comment.mentionIds) && comment.mentionIds.every((item) => typeof item === "string" && item.length <= 120) ? [...new Set(comment.mentionIds)] : [];
      const attachments = Array.isArray(comment.attachments) && comment.attachments.length <= 4 ? comment.attachments.map(commentAttachment) : [];
      if (attachments.some((item) => !item)) return [];
      return commentId && author && (commentText || attachments.length > 0) && commentCreatedAt ? [{ id: commentId, author, text: commentText ?? "", createdAt: commentCreatedAt, mentionIds, attachments: attachments as CommentAttachment[] }] : [];
    });
    tasks[id] = {
      id,
      title,
      checklist: normalizedChecklist as ChecklistItem[],
      priority: raw.priority as Task["priority"],
      status: raw.status as Task["status"],
      dueDate,
      labels: raw.labels,
      assigneeIds: raw.assigneeIds,
      comments,
      closed: raw.closed as boolean,
      archived: raw.archived as boolean,
      createdAt,
    };
  }

  return { boards, lists, tasks, activeBoardId };
}

export function deadlinesChanged(
  previous: Omit<WorkspaceData, "employees">,
  next: Omit<WorkspaceData, "employees">,
) {
  for (const [taskId, nextTask] of Object.entries(next.tasks)) {
    const previousTask = previous.tasks[taskId];
    if (!previousTask) {
      if (nextTask.dueDate || nextTask.checklist.some((item) => item.dueDate)) return true;
      continue;
    }
    if (previousTask.dueDate !== nextTask.dueDate) return true;
    const previousItems = new Map(previousTask.checklist.map((item) => [item.id, item.dueDate]));
    for (const item of nextTask.checklist) {
      if (!previousItems.has(item.id)) {
        if (item.dueDate) return true;
      } else if (previousItems.get(item.id) !== item.dueDate) {
        return true;
      }
    }
  }
  return false;
}

export function removedWorkspaceLabels(
  previous: Omit<WorkspaceData, "employees">,
  next: Omit<WorkspaceData, "employees">,
) {
  const previousLabels = new Set(Object.values(previous.tasks).flatMap((task) => task.labels));
  const nextLabels = new Set(Object.values(next.tasks).flatMap((task) => task.labels));
  return [...previousLabels].filter((label) => !nextLabels.has(label));
}
