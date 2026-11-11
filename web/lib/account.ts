/**
 * Player accounts — shared by client and server.
 *
 * A wallet becomes a player by signing a message that contains the handle it wants.
 * The signature proves wallet ownership, so no gas is needed and no contract is
 * required yet: Postgres is the source of truth until a registry contract lands.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;

/** Lowercase, starts with a letter, letters/digits/underscore only. */
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,15}$/;

/** Handles that would look official or break the UI. */
const RESERVED = new Set([
  "admin",
  "administrator",
  "arcade",
  "arcadeade",
  "support",
  "staff",
  "official",
  "system",
  "root",
  "help",
  "mod",
  "moderator",
  "team",
  "admin_arcade",
  "arc_ade",
  "null",
  "undefined",
  "player",
  "guest",
]);

export type UsernameCheck =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Handles are stored and displayed lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function checkUsername(raw: string): UsernameCheck {
  const value = normalizeUsername(raw);

  if (value.length < USERNAME_MIN) {
    return { ok: false, error: `At least ${USERNAME_MIN} characters.` };
  }
  if (value.length > USERNAME_MAX) {
    return { ok: false, error: `At most ${USERNAME_MAX} characters.` };
  }
  if (!/^[a-z]/.test(value)) {
    return { ok: false, error: "Start with a letter." };
  }
  if (!USERNAME_RE.test(value)) {
    return { ok: false, error: "Letters, numbers and underscores only." };
  }
  if (RESERVED.has(value)) {
    return { ok: false, error: "That handle is reserved." };
  }
  return { ok: true, value };
}

/** How long a registration signature stays valid. */
export const REGISTER_SIGNATURE_TTL_MS = 15 * 60 * 1000;

/**
 * The exact message a player signs to claim a handle. The handle is embedded, so a
 * signature for one handle can never be reused to claim another.
 */
export function buildRegisterMessage(username: string, issuedAt: string): string {
  return [
    "ARC-ADE",
    "Claim your player handle",
    "",
    `Handle: ${username}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

export interface PlayerAccount {
  address: string;
  username: string;
  createdAt: string;
  totalPoints: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  bestRank: number | null;
}

/** A player's placement in one tournament. */
export interface PlayerResult {
  tournamentId: string;
  gameId: string;
  day: string;
  rank: number;
  score: number;
  points: number;
}

export interface ProfilePayload {
  player: PlayerAccount;
  results: PlayerResult[];
  bestScores: { gameId: string; score: number }[];
}
