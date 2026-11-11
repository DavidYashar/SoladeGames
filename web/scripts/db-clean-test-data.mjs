/**
 * Removes the throwaway players created by scripts/e2e-account-test.mjs.
 * Handles match the pattern those tests generate: t + 6 hex chars.
 *
 *   node scripts/db-clean-test-data.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(path.resolve(here, ".."), ".env.local");

let url = process.env.DATABASE_URL;
if (!url && existsSync(envFile)) {
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (line) url = line.slice("DATABASE_URL=".length).trim();
}
if (!url) {
  console.error("DATABASE_URL missing.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const before = await client.query("SELECT count(*)::int AS n FROM players");
const del = await client.query(
  "DELETE FROM players WHERE username ~ '^t[0-9a-f]{6}$' RETURNING username",
);
const after = await client.query("SELECT count(*)::int AS n FROM players");

console.log(`removed ${del.rowCount} test player(s): ${del.rows.map((r) => r.username).join(", ") || "none"}`);
console.log(`players: ${before.rows[0].n} → ${after.rows[0].n}`);

await client.end();
