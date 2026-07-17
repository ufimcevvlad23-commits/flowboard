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
  if (raw.length > 12_000_000) return noStoreJson({ error: "Рабочее пространство слишком большое" }, { status: 413 });
  let body: { version?: unknown; workspace?: unknown };
  try { body = JSON.parse(raw); } catch { return noStoreJson({ error: "Некорректный запрос" }, { status: 400 }); }
  if (!Number.isInteger(body.version) || Number(body.version) < 1) return noStoreJson({ error: "Некорректная версия данных" }, { status: 400 });
  const submitted = sanitizeWorkspacePayload(body.workspace);
  if (!submitted) return noStoreJson({ error: "Некорректные данные рабочего пространства" }, { status: 400 });

  const sql = getSql();
  const currentRows = await sql`SELECT data, version FROM workspaces WHERE id = 'main' LIMIT 1` as Array<{ data: Omit<WorkspaceData, "employees">; version: number }>;
  const current = currentRows[0];
  if (!current) return noStoreJson({ error: "Рабочее пространство не найдено" }, { status: 404 });
  if (Number(current.version) !== Number(body.version)) return noStoreJson({ error: "Данные были изменены в другой вкладке", conflict: true }, { status: 409 });

  let workspace = submitted;
  if (!access.isAdmin) {
    const allowedBoardIds = user.boardIds.filter((id) => Boolean(current.data.boards[id]));
    const submittedBoardIds = Object.keys(submitted.boards);
    if (submittedBoardIds.length !== allowedBoardIds.length || submittedBoardIds.some((id) => !allowedBoardIds.includes(id))) {
      return noStoreJson({ error: "Изменять состав досок может только администратор" }, { status: 403 });
    }
    const previousListIds = new Set(allowedBoardIds.flatMap((id) => current.data.boards[id].listIds));
    const nextListIds = new Set(allowedBoardIds.flatMap((id) => submitted.boards[id].listIds));
    if ([...nextListIds].some((id) => !submitted.lists[id])) return noStoreJson({ error: "Некорректный состав списков" }, { status: 400 });
    const previousTaskIds = new Set([...previousListIds].flatMap((id) => current.data.lists[id]?.taskIds ?? []));
    const nextTaskIds = new Set([...nextListIds].flatMap((id) => submitted.lists[id]?.taskIds ?? []));
    if ([...nextTaskIds].some((id) => !submitted.tasks[id])) return noStoreJson({ error: "Некорректный состав задач" }, { status: 400 });
    const boards = { ...current.data.boards, ...submitted.boards };
    const lists = { ...current.data.lists };
    previousListIds.forEach((id) => delete lists[id]);
    nextListIds.forEach((id) => { lists[id] = submitted.lists[id]; });
    const tasks = { ...current.data.tasks };
    previousTaskIds.forEach((id) => delete tasks[id]);
    nextTaskIds.forEach((id) => { tasks[id] = submitted.tasks[id]; });
    workspace = { boards, lists, tasks, activeBoardId: current.data.activeBoardId };
  }

  if (!access.canEditDeadlines) {
    if (deadlinesChanged(current.data, workspace)) return noStoreJson({ error: "У вас нет права изменять дедлайны" }, { status: 403 });
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
