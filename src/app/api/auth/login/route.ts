import { createSession, performDummyPasswordCheck, verifyPassword } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { hasSameOrigin, noStoreJson } from "@/lib/http-security";

type LoginRow = {
  id: string;
  name: string;
  login: string;
  email: string | null;
  role: "admin" | "member";
  status: "active" | "deleted";
  password_hash: string | null;
  password_salt: string | null;
  failed_attempts: number;
  locked_until: string | Date | null;
};

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return noStoreJson({ error: "Недопустимый источник запроса" }, { status: 403 });
  let body: { login?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  const login = typeof body.login === "string" ? body.login.trim().toLocaleLowerCase("ru") : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!login || password.length < 1 || password.length > 128) return noStoreJson({ error: "Неверный логин или пароль" }, { status: 401 });

  const sql = getSql();
  const rows = await sql`
    SELECT id, name, login, email, role, status, password_hash, password_salt, failed_attempts, locked_until
    FROM employees WHERE LOWER(login) = ${login} LIMIT 1
  ` as LoginRow[];
  const employee = rows[0];
  if (!employee || employee.status !== "active" || !employee.password_hash || !employee.password_salt) {
    await performDummyPasswordCheck(password);
    return noStoreJson({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  if (employee.locked_until && new Date(employee.locked_until).getTime() > Date.now()) {
    return noStoreJson({ error: "Слишком много попыток. Повторите вход через 15 минут" }, { status: 429 });
  }

  const valid = await verifyPassword(password, employee.password_salt, employee.password_hash);
  if (!valid) {
    await sql`
      UPDATE employees
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
      WHERE id = ${employee.id}
    `;
    return noStoreJson({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  await sql`UPDATE employees SET failed_attempts = 0, locked_until = NULL WHERE id = ${employee.id}`;
  await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
  await createSession(employee.id);
  return noStoreJson({ user: { id: employee.id, name: employee.name, login: employee.login, email: employee.email ?? undefined, role: employee.role } });
}
