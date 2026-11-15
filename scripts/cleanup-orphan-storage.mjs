// Deletes images in the shop-media bucket that nothing in the database
// points at any more: replaced logos/covers, photos of deleted rows, uploads
// whose form was never saved, folders of deleted shops. (Dashboard edits
// already delete the old image when they replace it; this catches the rest.)
//
// Dry run by default: lists what would go. From the repo root:
//   npm run storage:cleanup              # dry run
//   npm run storage:cleanup -- --apply   # delete
//
// Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
// Storage files can only be deleted through the Storage API, not SQL.
//
// A file counts as in use when its path appears anywhere in a row of TABLES
// (so a link pasted into a WhatsApp template is respected too, not only the
// image columns). Files younger than a day are skipped, so an image being
// uploaded right now isn't caught before its row is saved. Ported from
// zhewar scripts/cleanup-orphan-storage.mts.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "shop-media";
const TABLES = ["shop_profile", "services", "staff", "gallery_photos", "posts", "social_links", "locations", "whatsapp_templates"];
const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE = 1000; // Storage list/remove and PostgREST selects cap out around 1000

function loadEnv() {
  const file = new URL("../.env.local", import.meta.url);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}

/** Every file under a prefix (folders have no id: walk into them). */
async function listAll(supabase, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    for (const f of data) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      if (!f.id) files.push(...(await listAll(supabase, path)));
      else files.push({ path, bytes: f.metadata?.size ?? 0, createdAt: f.created_at ?? null });
    }
    if (data.length < PAGE) return files;
  }
}

/** Every row of TABLES as one string, searched for each file's path. */
async function readReferences(supabase) {
  const chunks = [];
  for (const table of TABLES) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
      if (error) throw new Error(`read ${table}: ${error.message}`);
      for (const row of data) chunks.push(JSON.stringify(row));
      if (data.length < PAGE) break;
    }
  }
  return chunks.join("\n");
}

const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString("en")} KB`;

async function main() {
  const apply = process.argv.includes("--apply");
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const files = await listAll(supabase);
  // Read after listing, so a row saved meanwhile still protects its file.
  const references = await readReferences(supabase);
  const inUse = (f) => references.includes(`/${BUCKET}/${f.path}`);

  // Nothing in use at all means the tables came back empty (wrong project,
  // missing key): deleting on that basis would wipe every live image.
  if (files.length && !files.some(inUse)) throw new Error("No file is referenced by the database: refusing to continue");

  const cutoff = Date.now() - MIN_AGE_MS;
  // A file with no upload time is kept, since its age can't be checked.
  const orphans = files.filter((f) => !inUse(f) && f.createdAt !== null && Date.parse(f.createdAt) < cutoff);

  console.log(`${BUCKET}: ${files.length} files, ${orphans.length} unused`);
  for (const f of orphans) console.log(`  ${(f.createdAt ?? "").slice(0, 10)}  ${kb(f.bytes).padStart(9)}  ${f.path}`);
  const total = orphans.reduce((s, f) => s + f.bytes, 0);
  console.log(`\nTotal: ${orphans.length} unused files, ${(total / 1024 / 1024).toFixed(1)} MB`);

  if (!apply) {
    console.log("\nDry run: nothing deleted. Run again with --apply to delete these files.");
    return;
  }
  const paths = orphans.map((f) => f.path);
  for (let i = 0; i < paths.length; i += PAGE) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + PAGE));
    if (error) throw new Error(`remove: ${error.message}`);
  }
  console.log(`Deleted ${paths.length} files.`);
}

main().catch((e) => {
  console.error(`\nFailed: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
