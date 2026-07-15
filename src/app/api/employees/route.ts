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
  let body: { name?: unknown; login?: unknown; email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const login = typeof body.login === "string" ? body.login.trim().toLocaleLowerCase("ru") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLocaleLowerCase("ru") : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 100) return noStoreJson({ error: "Имя должно содержать от 2 до 100 символов" }, { status: 400 });
  if (!validLogin(login)) return noStoreJson({ error: "Проверьте email или логин" }, { status: 400 });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return noStoreJson({ error: "Проверьте email сотрудника" }, { status: 400 });
  if (!validPassword(password)) return noStoreJson({ error: "Пароль: минимум 10 символов, буква и цифра" }, { status: 400 });
  const passwordData = await hashPassword(password);
  const sql = getSql();
  try {
    const rows = await sql`
      INSERT INTO employees (id, name, login, email, password_hash, password_salt, role, status)
      VALUES (${`employee-${randomUUID()}`}, ${name}, ${login}, ${email || null}, ${passwordData.hash}, ${passwordData.salt}, 'member', 'active')
      RETURNING id, name, login, email, status, role, created_at, deleted_at
    ` as EmployeeRow[];
    return noStoreJson({ employee: employeeDto(rows[0]) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return noStoreJson({ error: "Такой email или логин уже используется" }, { status: 409 });
    throw error;
  }
}
