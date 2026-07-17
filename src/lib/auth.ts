import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";
import type { SessionUser } from "@/types/board";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "flowboard_session";
const SESSION_DAYS = 7;

type SessionRow = {
  id: string;
  name: string;
  login: string;
  email: string | null;
  role: "admin" | "member" | "guest";
  can_edit_deadlines: boolean;
  board_ids: unknown;
};

export async function hashPassword(password: string, salt = randomBytes(16).toString("base64url")) {
  const key = await scrypt(password, salt, 64) as Buffer;
  return { salt, hash: key.toString("base64url") };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function performDummyPasswordCheck(password: string) {
  await scrypt(password, "flowboard-missing-account", 64);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function toSessionUser(row: SessionRow): SessionUser {
  return { id: row.id, name: row.name, login: row.login, email: row.email ?? undefined, role: row.role, canEditDeadlines: row.can_edit_deadlines, boardIds: Array.isArray(row.board_ids) ? row.board_ids.filter((id): id is string => typeof id === "string") : [] };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT e.id, e.name, e.login, e.email, e.role, e.can_edit_deadlines, e.board_ids
    FROM sessions s
    INNER JOIN employees e ON e.id = s.employee_id
    WHERE s.token_hash = ${tokenHash(token)}
      AND s.expires_at > NOW()
      AND e.status = 'active'
    LIMIT 1
  ` as SessionRow[];
  return rows[0] ? toSessionUser(rows[0]) : null;
}

export async function createSession(employeeId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sql = getSql();
  await sql`INSERT INTO sessions (token_hash, employee_id, expires_at) VALUES (${tokenHash(token)}, ${employeeId}, ${expiresAt.toISOString()})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const sql = getSql();
    await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`;
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeEmployeeSessions(employeeId: string) {
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE employee_id = ${employeeId}`;
}
