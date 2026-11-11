// Applies migration files to the live Supabase database.
//
//   npm run db:migrate -- 0007_blocked_hours.sql      (one or more files)
//
// - Only files inside supabase/migrations/ are accepted (no other paths).
// - Each file runs inside one transaction: it applies fully or not at all.
// - The connection string is SUPABASE_DB_URL from .env.local; it is never printed.
// Applied migrations are never edited: add a new numbered file instead.

import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: npm run db:migrate -- <file in supabase/migrations> [...]");
  process.exit(1);
}

const envFile = join(root, ".env.local");
const env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const url = (process.env.SUPABASE_DB_URL ?? env.match(/^SUPABASE_DB_URL=(.*)$/m)?.[1] ?? "").trim().replace(/^"|"$/g, "");
if (!url) {
  console.error("SUPABASE_DB_URL is missing (.env.local).");
  process.exit(1);
}

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
let failed = false;
try {
  for (const arg of files) {
    const name = basename(arg);
    if (name !== arg || !/^\d{4}_[a-z0-9_]+\.sql$/.test(name)) {
      console.error(`Skipped "${arg}": give a file name from supabase/migrations, like 0007_blocked_hours.sql`);
      failed = true;
      break;
    }
    const path = join(root, "supabase", "migrations", name);
    if (!existsSync(path)) {
      console.error(`Not found: supabase/migrations/${name}`);
      failed = true;
      break;
    }
    try {
      await db.query("begin");
      await db.query(readFileSync(path, "utf8"));
      await db.query("commit");
      console.log(`applied  ${name}`);
    } catch (e) {
      await db.query("rollback");
      console.error(`FAILED   ${name} (rolled back): ${e.code ?? ""} ${e.message}`);
      failed = true;
      break;
    }
  }
} finally {
  await db.end();
}
process.exit(failed ? 1 : 0);
