import { getSessionUser } from "@/lib/auth";
import { getAuthorizedWorkspaceSnapshot } from "@/lib/dal";
import { getSql } from "@/lib/db";
import { hasSameOrigin, noStoreJson } from "@/lib/http-security";
import { getAccess } from "@/lib/permissions";
import { deadlinesChanged, sanitizeWorkspacePayload } from "@/lib/workspace-validation";
import type { WorkspaceData } from "@/types/board";

export async function GET() {
  const snapshot = await getAuthorizedWorkspaceSnapshot();
  if (!snapshot) return noStoreJson({ error: "Требуется вход" }, { status: 401 });
  return noStoreJson(snapshot);
}

export async function PUT(request: Request) {
  if (!hasSameOrigin(request)) return noStoreJson({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return noStoreJson({ error: "Требуется вход" }, { status: 401 });
  const access = getAccess(user);
  if (!access.canEditWorkspace) return noStoreJson({ error: "Гость может только просматривать задачи" }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 1_500_000) return noStoreJson({ error: "Рабочее пространство слишком большое" }, { status: 413 });
  let body: { version?: unknown; workspace?: unknown };
  try { body = JSON.parse(raw); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  if (!Number.isInteger(body.version) || Number(body.version) < 1) return noStoreJson({ error: "Некорректная версия данных" }, { status: 400 });
  const workspace = sanitizeWorkspacePayload(body.workspace);
  if (!workspace) return noStoreJson({ error: "Некорректные данные рабочего пространства" }, { status: 400 });

  const sql = getSql();
  if (!access.canEditDeadlines) {
    const rows = await sql`SELECT data FROM workspaces WHERE id = 'main' LIMIT 1` as Array<{ data: Omit<WorkspaceData, "employees"> }>;
    if (!rows[0]) return noStoreJson({ error: "Рабочее пространство не найдено" }, { status: 404 });
    if (deadlinesChanged(rows[0].data, workspace)) return noStoreJson({ error: "У вас нет права изменять дедлайны" }, { status: 403 });
  }
  const result = await sql`
    UPDATE workspaces
    SET data = ${JSON.stringify(workspace)}::jsonb, version = version + 1, updated_at = NOW()
    WHERE id = 'main' AND version = ${Number(body.version)}
    RETURNING version
  ` as Array<{ version: number }>;
  if (!result[0]) return noStoreJson({ error: "Данные были изменены в другой вкладке", conflict: true }, { status: 409 });
  return noStoreJson({ version: Number(result[0].version) });
}
