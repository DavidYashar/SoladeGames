import { sql } from "./db";
import type { PlayerAccount, PlayerResult } from "@/lib/account";

/**
 * Player account persistence. Postgres is the source of truth for handles, points
 * and tournament history until a registry contract replaces it.
 */

interface PlayerRow {
  address: string;
  username: string;
  created_at: Date;
  total_points: string | number;
  tournaments_played: number;
  tournaments_won: number;
  best_rank: number | null;
}

function toAccount(row: PlayerRow): PlayerAccount {
  return {
    address: row.address,
    username: row.username,
    createdAt: row.created_at.toISOString(),
    totalPoints: Number(row.total_points),
    tournamentsPlayed: Number(row.tournaments_played),
    tournamentsWon: Number(row.tournaments_won),
    bestRank: row.best_rank,
  };
}

const SELECT_COLUMNS = `
  address, username, created_at, total_points,
  tournaments_played, tournaments_won, best_rank
`;

export async function getPlayer(address: string): Promise<PlayerAccount | null> {
  const rows = await sql<PlayerRow>(
    `SELECT ${SELECT_COLUMNS} FROM players WHERE address = $1`,
    [address.toLowerCase()],
  );
  return rows.length > 0 ? toAccount(rows[0]) : null;
}

/**
 * Claims a handle for a wallet. Uniqueness is enforced by the database, so two
 * simultaneous claims can never both succeed.
 */
export async function registerPlayer(
  address: string,
  username: string,
): Promise<
  | { ok: true; player: PlayerAccount }
  | { ok: false; reason: "handle_taken" | "wallet_taken" }
> {
  const rows = await sql<PlayerRow>(
    `INSERT INTO players (address, username)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING ${SELECT_COLUMNS}`,
    [address.toLowerCase(), username],
  );

  if (rows.length > 0) return { ok: true, player: toAccount(rows[0]) };

  // The insert was rejected — find out which uniqueness rule fired.
  const existingHandle = await sql<{ address: string }>(
    `SELECT address FROM players WHERE username = $1`,
    [username],
  );
  if (existingHandle.length > 0) {
    // Re-claiming your own handle is a no-op, not a conflict.
    if (existingHandle[0].address.toLowerCase() === address.toLowerCase()) {
      const existing = await getPlayer(address);
      if (existing) return { ok: true, player: existing };
    }
    return { ok: false, reason: "handle_taken" };
  }

  const existingWallet = await getPlayer(address);
  if (existingWallet) return { ok: true, player: existingWallet };

  return { ok: false, reason: "wallet_taken" };
}

export async function touchPlayer(address: string): Promise<void> {
  await sql(`UPDATE players SET last_seen_at = now() WHERE address = $1`, [
    address.toLowerCase(),
  ]);
}

export async function getPlayerResults(
  address: string,
  limit = 20,
): Promise<PlayerResult[]> {
  const rows = await sql<{
    tournament_id: string;
    game_id: string;
    day: Date;
    rank: number;
    score: string | number;
    points_awarded: number;
  }>(
    `SELECT r.tournament_id, t.game_id, t.day, r.rank, r.score, r.points_awarded
       FROM tournament_results r
       JOIN tournaments t ON t.id = r.tournament_id
      WHERE r.address = $1
      ORDER BY t.day DESC, r.rank ASC
      LIMIT $2`,
    [address.toLowerCase(), limit],
  );

  return rows.map((r) => ({
    tournamentId: r.tournament_id,
    gameId: r.game_id,
    day: r.day.toISOString().slice(0, 10),
    rank: r.rank,
    score: Number(r.score),
    points: Number(r.points_awarded),
  }));
}

/** Personal best per cabinet, across every recorded tournament run. */
export async function getBestScores(
  address: string,
): Promise<{ gameId: string; score: number }[]> {
  const rows = await sql<{ game_id: string; best: string | number }>(
    `SELECT game_id, MAX(score) AS best
       FROM runs
      WHERE address = $1
      GROUP BY game_id
      ORDER BY game_id`,
    [address.toLowerCase()],
  );
  return rows.map((r) => ({ gameId: r.game_id, score: Number(r.best) }));
}
