export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "backlog" | "in-progress" | "review" | "done";
export type EmployeeStatus = "active" | "deleted";
export type EmployeeRole = "admin" | "member" | "guest";

export interface CommentAttachment {
  id: string;
  name: string;
  type: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
  size: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  mentionIds: string[];
  attachments: CommentAttachment[];
}
export interface Employee {
  id: string;
  name: string;
  login: string;
  email?: string;
  status: EmployeeStatus;
  role: EmployeeRole;
  canEditDeadlines: boolean;
  boardIds: string[];
  createdAt: string;
  deletedAt?: string;
}
export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  createdAt: string;
}
export interface Task {
  id: string;
  title: string;
  checklist: ChecklistItem[];
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  labels: string[];
  assigneeIds: string[];
  comments: Comment[];
  closed: boolean;
  archived: boolean;
  createdAt: string;
}

export interface List {
  id: string;
  title: string;
  taskIds: string[];
  collapsed: boolean;
  archived: boolean;
}

export interface Board {
  id: string;
  title: string;
  description: string;
  color: string;
  listIds: string[];
  createdAt: string;
}

export interface WorkspaceData {
  boards: Record<string, Board>;
  lists: Record<string, List>;
  tasks: Record<string, Task>;
  employees: Record<string, Employee>;
  activeBoardId: string;
}

export interface TaskDraft {
  title: string;
  checklist: ChecklistItem[];
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  labels: string[];
  assigneeIds: string[];
}

export interface SessionUser {
  id: string;
  name: string;
  login: string;
  email?: string;
  role: EmployeeRole;
  canEditDeadlines: boolean;
  boardIds: string[];
}

export interface WorkspaceSnapshot {
  workspace: WorkspaceData;
  version: number;
  currentUser: SessionUser;
  readNotificationIds: string[];
}

export interface Filters {
  priorities: Priority[];
  statuses: TaskStatus[];
  label: string;
  due: "all" | "overdue" | "today" | "week";
}
