import { Pool } from "pg";

/**
 * Single Postgres pool for the whole server process.
 *
 * Cached on globalThis so Next.js hot reload does not open a new pool on every
 * module re-evaluation. `DATABASE_URL` is server-only — never expose it to the client.
 */

const globalForDb = globalThis as unknown as { __arcadePool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to games/web/.env.local (see .env.example).",
    );
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function getPool(): Pool {
  if (!globalForDb.__arcadePool) globalForDb.__arcadePool = createPool();
  return globalForDb.__arcadePool;
}

/** Parameterised query helper — never build SQL with string concatenation. */
export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

/** Runs a set of statements in a transaction. */
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
