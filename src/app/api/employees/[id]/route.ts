import { getSessionUser, revokeEmployeeSessions } from "@/lib/auth";
import { employeeDto } from "@/lib/dal";
import { getSql } from "@/lib/db";
import { hasSameOrigin, noStoreJson } from "@/lib/http-security";
import type { EmployeeRole } from "@/types/board";

type EmployeeRow = Parameters<typeof employeeDto>[0];

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasSameOrigin(request)) return noStoreJson({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return noStoreJson({ error: "Требуется вход" }, { status: 401 });
  if (user.role !== "admin") return noStoreJson({ error: "Недостаточно прав" }, { status: 403 });
  const { id } = await context.params;
  if (id === user.id) return noStoreJson({ error: "Нельзя удалить собственную учётную запись" }, { status: 400 });
  const sql = getSql();
  const current = await sql`SELECT role, status FROM employees WHERE id = ${id} LIMIT 1` as Array<{ role: string; status: string }>;
  if (!current[0]) return noStoreJson({ error: "Сотрудник не найден" }, { status: 404 });
  if (current[0].role === "admin") return noStoreJson({ error: "Нельзя удалить администратора" }, { status: 400 });
  const rows = await sql`
    UPDATE employees
    SET status = 'deleted', deleted_at = NOW(), password_hash = NULL, password_salt = NULL, failed_attempts = 0, locked_until = NULL
    WHERE id = ${id}
    RETURNING id, name, login, email, status, role, can_edit_deadlines, created_at, deleted_at
  ` as EmployeeRow[];
  await revokeEmployeeSessions(id);
  return noStoreJson({ employee: employeeDto(rows[0]) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasSameOrigin(request)) return noStoreJson({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return noStoreJson({ error: "Требуется вход" }, { status: 401 });
  if (user.role !== "admin") return noStoreJson({ error: "Недостаточно прав" }, { status: 403 });
  const { id } = await context.params;
  if (id === user.id) return noStoreJson({ error: "Собственные права администратора изменить нельзя" }, { status: 400 });

  let body: { role?: unknown; canEditDeadlines?: unknown };
  try { body = await request.json(); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  const role: EmployeeRole | null = body.role === "admin" || body.role === "member" || body.role === "guest" ? body.role : null;
  if (!role) return noStoreJson({ error: "Выберите корректную роль" }, { status: 400 });
  const canEditDeadlines = role === "admin" ? true : role === "guest" ? false : body.canEditDeadlines === true;

  const sql = getSql();
  const rows = await sql`
    UPDATE employees
    SET role = ${role}, can_edit_deadlines = ${canEditDeadlines}
    WHERE id = ${id} AND status = 'active'
    RETURNING id, name, login, email, status, role, can_edit_deadlines, created_at, deleted_at
  ` as EmployeeRow[];
  if (!rows[0]) return noStoreJson({ error: "Активный сотрудник не найден" }, { status: 404 });
  return noStoreJson({ employee: employeeDto(rows[0]) });
}
