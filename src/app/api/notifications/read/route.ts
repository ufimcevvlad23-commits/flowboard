import { getSessionUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { hasSameOrigin, noStoreJson } from "@/lib/http-security";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return noStoreJson({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return noStoreJson({ error: "Требуется вход" }, { status: 401 });

  let body: { notificationId?: unknown };
  try { body = await request.json(); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  const notificationId = typeof body.notificationId === "string" ? body.notificationId.trim() : "";
  if (!notificationId || notificationId.length > 300 || /[\u0000-\u001f]/.test(notificationId)) {
    return noStoreJson({ error: "Некорректный идентификатор уведомления" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    UPDATE employees
    SET read_notification_ids = CASE
      WHEN read_notification_ids @> ${JSON.stringify([notificationId])}::jsonb THEN read_notification_ids
      ELSE read_notification_ids || ${JSON.stringify([notificationId])}::jsonb
    END
    WHERE id = ${user.id} AND status = 'active'
  `;
  return noStoreJson({ ok: true });
}
