import { randomUUID } from "node:crypto";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { employeeDto } from "@/lib/dal";
import { getSql } from "@/lib/db";
import { hasSameOrigin, noStoreJson, validLogin, validPassword } from "@/lib/http-security";

type EmployeeRow = Parameters<typeof employeeDto>[0];

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return noStoreJson({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return noStoreJson({ error: "Требуется вход" }, { status: 401 });
  if (user.role !== "admin") return noStoreJson({ error: "Недостаточно прав" }, { status: 403 });
  let body: { name?: unknown; login?: unknown; email?: unknown; password?: unknown; role?: unknown; canEditDeadlines?: unknown; boardIds?: unknown };
  try { body = await request.json(); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const login = typeof body.login === "string" ? body.login.trim().toLocaleLowerCase("ru") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLocaleLowerCase("ru") : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "admin" || body.role === "guest" ? body.role : "member";
  const canEditDeadlines = role === "admin" ? true : role === "guest" ? false : body.canEditDeadlines !== false;
  const boardIds = Array.isArray(body.boardIds) && body.boardIds.every((id) => typeof id === "string" && id.length <= 120) ? [...new Set(body.boardIds)] : [];
  if (name.length < 2 || name.length > 100) return noStoreJson({ error: "Имя должно содержать от 2 до 100 символов" }, { status: 400 });
  if (!validLogin(login)) return noStoreJson({ error: "Проверьте email или логин" }, { status: 400 });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return noStoreJson({ error: "Проверьте email сотрудника" }, { status: 400 });
  if (!validPassword(password)) return noStoreJson({ error: "Пароль: минимум 10 символов, буква и цифра" }, { status: 400 });
  const passwordData = await hashPassword(password);
  const sql = getSql();
  const workspaceRows = await sql`SELECT data->'boards' AS boards FROM workspaces WHERE id = 'main' LIMIT 1` as Array<{ boards: Record<string, unknown> }>;
  const existingBoardIds = new Set(Object.keys(workspaceRows[0]?.boards ?? {}));
  if (boardIds.some((id) => !existingBoardIds.has(id))) return noStoreJson({ error: "Одна из выбранных досок не существует" }, { status: 400 });
  try {
    const rows = await sql`
      INSERT INTO employees (id, name, login, email, password_hash, password_salt, role, can_edit_deadlines, board_ids, status)
      VALUES (${`employee-${randomUUID()}`}, ${name}, ${login}, ${email || null}, ${passwordData.hash}, ${passwordData.salt}, ${role}, ${canEditDeadlines}, ${JSON.stringify(boardIds)}::jsonb, 'active')
      RETURNING id, name, login, email, status, role, can_edit_deadlines, board_ids, created_at, deleted_at
    ` as EmployeeRow[];
    return noStoreJson({ employee: employeeDto(rows[0]) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return noStoreJson({ error: "Такой email или логин уже используется" }, { status: 409 });
    throw error;
  }
}
