import { getSessionUser, revokeEmployeeSessions } from "@/lib/auth";
import { employeeDto } from "@/lib/dal";
import { getSql } from "@/lib/db";
import { hasSameOrigin, noStoreJson, validLogin } from "@/lib/http-security";
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

  let body: { name?: unknown; login?: unknown; email?: unknown; role?: unknown; canEditDeadlines?: unknown };
  try { body = await request.json(); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  const sql = getSql();
  const currentRows = await sql`
    SELECT id, name, login, email, status, role, can_edit_deadlines, created_at, deleted_at
    FROM employees WHERE id = ${id} AND status = 'active' LIMIT 1
  ` as EmployeeRow[];
  const current = currentRows[0];
  if (!current) return noStoreJson({ error: "Активный сотрудник не найден" }, { status: 404 });

  const hasProfileChanges = Object.hasOwn(body, "name") || Object.hasOwn(body, "login") || Object.hasOwn(body, "email");
  const hasAccessChanges = Object.hasOwn(body, "role") || Object.hasOwn(body, "canEditDeadlines");
  if (!hasProfileChanges && !hasAccessChanges) return noStoreJson({ error: "Нет изменений для сохранения" }, { status: 400 });
  if (hasAccessChanges && id === user.id) return noStoreJson({ error: "Собственные права администратора изменить нельзя" }, { status: 400 });

  const name = Object.hasOwn(body, "name") && typeof body.name === "string" ? body.name.trim() : current.name;
  const login = Object.hasOwn(body, "login") && typeof body.login === "string" ? body.login.trim().toLocaleLowerCase("ru") : current.login;
  const email = Object.hasOwn(body, "email") && typeof body.email === "string" ? body.email.trim().toLocaleLowerCase("ru") : current.email ?? "";
  if (name.length < 2 || name.length > 100) return noStoreJson({ error: "Имя должно содержать от 2 до 100 символов" }, { status: 400 });
  if (!validLogin(login)) return noStoreJson({ error: "Проверьте email или логин" }, { status: 400 });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return noStoreJson({ error: "Проверьте email сотрудника" }, { status: 400 });

  const role: EmployeeRole = Object.hasOwn(body, "role")
    ? body.role === "admin" || body.role === "member" || body.role === "guest" ? body.role : current.role
    : current.role;
  if (Object.hasOwn(body, "role") && body.role !== "admin" && body.role !== "member" && body.role !== "guest") {
    return noStoreJson({ error: "Выберите корректную роль" }, { status: 400 });
  }
  const canEditDeadlines = role === "admin" ? true : role === "guest" ? false : Object.hasOwn(body, "canEditDeadlines") ? body.canEditDeadlines === true : current.can_edit_deadlines;

  try {
    const rows = await sql`
      UPDATE employees
      SET name = ${name}, login = ${login}, email = ${email || null}, role = ${role}, can_edit_deadlines = ${canEditDeadlines}
      WHERE id = ${id} AND status = 'active'
      RETURNING id, name, login, email, status, role, can_edit_deadlines, created_at, deleted_at
    ` as EmployeeRow[];
    return noStoreJson({ employee: employeeDto(rows[0]) });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return noStoreJson({ error: "Такой email или логин уже используется" }, { status: 409 });
    throw error;
  }
}
