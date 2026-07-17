import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import { seedData } from "../src/lib/seed";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = neon(databaseUrl);
const scrypt = promisify(scryptCallback);

async function main() {
const existingWorkspace = await sql`SELECT id FROM workspaces WHERE id = 'main' LIMIT 1`;
if (!existingWorkspace[0]) {
  const workspace = { boards: seedData.boards, lists: seedData.lists, tasks: seedData.tasks, activeBoardId: seedData.activeBoardId };
  await sql`INSERT INTO workspaces (id, data) VALUES ('main', ${JSON.stringify(workspace)}::jsonb)`;
}

const credentials: Array<{ name: string; login: string; password: string; role: string }> = [];
for (const employee of Object.values(seedData.employees)) {
  const existing = await sql`SELECT id FROM employees WHERE id = ${employee.id} LIMIT 1`;
  if (existing[0]) continue;
  const password = `Fb-${randomBytes(10).toString("base64url")}9`;
  const salt = randomBytes(16).toString("base64url");
  const passwordHash = (await scrypt(password, salt, 64) as Buffer).toString("base64url");
  await sql`
    INSERT INTO employees (id, name, login, email, password_hash, password_salt, role, can_edit_deadlines, board_ids, status, created_at)
    VALUES (${employee.id}, ${employee.name}, ${employee.login}, ${employee.email ?? null}, ${passwordHash}, ${salt}, ${employee.role}, ${employee.canEditDeadlines}, ${JSON.stringify(employee.boardIds)}::jsonb, ${employee.status}, ${employee.createdAt})
  `;
  credentials.push({ name: employee.name, login: employee.login, password, role: employee.role });
}

if (credentials.length > 0) {
  const lines = [
    "Flowboard — тестовые учётные записи",
    "Храните файл в безопасном месте. Он исключён из Git.",
    "",
    ...credentials.flatMap((item) => [`${item.name} (${item.role})`, `Логин: ${item.login}`, `Пароль: ${item.password}`, ""]),
  ];
  await writeFile(".flowboard-admin-credentials.txt", lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  console.log("Test credentials were written to .flowboard-admin-credentials.txt");
}

console.log("Workspace seed is ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exitCode = 1;
});
