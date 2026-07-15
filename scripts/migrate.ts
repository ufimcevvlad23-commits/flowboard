import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = neon(databaseUrl);

async function main() {
await sql`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    login TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    password_salt TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
    can_edit_deadlines BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
  )
`;
await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_edit_deadlines BOOLEAN NOT NULL DEFAULT TRUE`;
await sql`ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check`;
await sql`ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role IN ('admin', 'member', 'guest'))`;
await sql`UPDATE employees SET can_edit_deadlines = TRUE WHERE role = 'admin'`;
await sql`UPDATE employees SET can_edit_deadlines = FALSE WHERE role = 'guest'`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS employees_login_unique ON employees (LOWER(login))`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS employees_email_unique ON employees (LOWER(email)) WHERE email IS NOT NULL`;

await sql`
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS sessions_employee_idx ON sessions (employee_id)`;
await sql`CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at)`;

await sql`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

console.log("Database schema is ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
});
