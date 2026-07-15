export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "backlog" | "in-progress" | "review" | "done";

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}
export interface Employee {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  labels: string[];
  assigneeIds: string[];
  comments: Comment[];
  notes: string;
  pinned: boolean;
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
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  labels: string[];
  assigneeIds: string[];
  notes: string;
}

export interface Filters {
  priorities: Priority[];
  statuses: TaskStatus[];
  label: string;
  due: "all" | "overdue" | "today" | "week";
}
