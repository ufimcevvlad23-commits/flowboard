import "server-only";

import { getSessionUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import type { Employee, SessionUser, WorkspaceData, WorkspaceSnapshot } from "@/types/board";

type EmployeeRow = {
  id: string;
  name: string;
  login: string;
  email: string | null;
  status: "active" | "deleted";
  role: "admin" | "member" | "guest";
  can_edit_deadlines: boolean;
  created_at: string | Date;
  deleted_at: string | Date | null;
};

type WorkspaceRow = { data: Omit<WorkspaceData, "employees">; version: number };

export function employeeDto(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    email: row.email ?? undefined,
    status: row.status,
    role: row.role,
    canEditDeadlines: row.can_edit_deadlines,
    createdAt: new Date(row.created_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : undefined,
  };
}

export async function getEmployeeDtos() {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, login, email, status, role, can_edit_deadlines, created_at, deleted_at
    FROM employees
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, name ASC
  ` as EmployeeRow[];
  return Object.fromEntries(rows.map((row) => [row.id, employeeDto(row)]));
}

export async function getWorkspaceSnapshotFor(user: SessionUser): Promise<WorkspaceSnapshot> {
  const sql = getSql();
  const rows = await sql`SELECT data, version FROM workspaces WHERE id = 'main' LIMIT 1` as WorkspaceRow[];
  if (!rows[0]) throw new Error("Workspace is not initialized");
  const employeeDtos = await getEmployeeDtos();
  const employees = user.role === "guest"
    ? Object.fromEntries(Object.entries(employeeDtos).map(([id, employee]) => [id, { ...employee, login: "", email: undefined }]))
    : employeeDtos;
  const data = rows[0].data;
  const tasks = Object.fromEntries(Object.entries(data.tasks ?? {}).map(([id, task]) => [id, {
    ...task,
    checklist: Array.isArray(task.checklist) ? task.checklist : [],
  }]));
  return {
    currentUser: user,
    version: Number(rows[0].version),
    workspace: { ...data, tasks, employees },
  };
}

export async function getAuthorizedWorkspaceSnapshot() {
  const user = await getSessionUser();
  if (!user) return null;
  return getWorkspaceSnapshotFor(user);
}
