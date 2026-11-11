/**
 * Provisions the ARC-ADE Postgres schema.
 *
 *   node scripts/db-init.mjs             → create database + tables (idempotent)
 *   node scripts/db-init.mjs --seed      → also insert demo data (dev only)
 *
 * Reads DATABASE_URL from games/web/.env.local. The database itself is created by
 * connecting to the maintenance `postgres` database with the same credentials.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

function loadEnvLocal() {
  const file = path.join(webRoot, ".env.local");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnvLocal();
const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing — add it to games/web/.env.local");
  process.exit(1);
}

const target = new URL(url);
const dbName = target.pathname.replace(/^\//, "") || "arcade";

/* ---------- 1. make sure the database exists ---------- */

const admin = new URL(url);
admin.pathname = "/postgres";

const adminClient = new pg.Client({ connectionString: admin.toString() });
await adminClient.connect();
const found = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
  dbName,
]);
if (found.rowCount === 0) {
  // Identifier cannot be parameterised; dbName comes from our own config.
  await adminClient.query(`CREATE DATABASE ${JSON.stringify(dbName).replace(/"/g, '"')}`);
  console.log(`created database ${dbName}`);
} else {
  console.log(`database ${dbName} already exists`);
}
await adminClient.end();

/* ---------- 2. schema ---------- */

const SCHEMA = `
-- Player accounts. One row per wallet; the handle is globally unique.
CREATE TABLE IF NOT EXISTS players (
  address       TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lowercase handles only: this enforces it at the storage layer too.
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_username_format;
ALTER TABLE players ADD CONSTRAINT players_username_format
  CHECK (username ~ '^[a-z][a-z0-9_]{2,15}$');

CREATE INDEX IF NOT EXISTS players_username_idx ON players (lower(username));

-- A tournament is one cabinet on one UTC day, for now.
CREATE TABLE IF NOT EXISTS tournaments (
  id          TEXT PRIMARY KEY,            -- e.g. "stack-tower:2026-11-04"
  game_id     TEXT NOT NULL,
  day         DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'settled')),
  settled_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, day)
);

-- Only players who joined a tournament get runs recorded. Free play writes nothing.
CREATE TABLE IF NOT EXISTS tournament_entries (
  tournament_id TEXT NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  address       TEXT NOT NULL REFERENCES players (address) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, address)
);

-- One run per player per tournament. Keeps the best score only.
CREATE TABLE IF NOT EXISTS runs (
  id            BIGSERIAL PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  address       TEXT NOT NULL REFERENCES players (address) ON DELETE CASCADE,
  game_id       TEXT NOT NULL,
  score         BIGINT NOT NULL CHECK (score >= 0),
  points        INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, address)
);

CREATE INDEX IF NOT EXISTS runs_leaderboard_idx
  ON runs (tournament_id, score DESC, updated_at ASC);

-- Final placements, written when a tournament settles. Drives profile trophies.
CREATE TABLE IF NOT EXISTS tournament_results (
  tournament_id TEXT NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  address       TEXT NOT NULL REFERENCES players (address) ON DELETE CASCADE,
  rank          INTEGER NOT NULL CHECK (rank > 0),
  score         BIGINT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, address)
);

CREATE INDEX IF NOT EXISTS results_address_idx ON tournament_results (address, rank);

-- Lifetime aggregates, updated atomically as tournaments settle.
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_points BIGINT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tournaments_played INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tournaments_won INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS best_rank INTEGER;
`;

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(SCHEMA);
console.log("schema applied");

if (process.argv.includes("--seed")) {
  await client.query(
    `INSERT INTO players (address, username) VALUES
       ('0x1111111111111111111111111111111111111111', 'neonking'),
       ('0x2222222222222222222222222222222222222222', 'pixelpilot')
     ON CONFLICT DO NOTHING`,
  );
  console.log("seeded 2 demo players");
}

const tables = await client.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`,
);
console.log("tables:", tables.rows.map((r) => r.table_name).join(", "));
await client.end();
