/** Deterministic, seedable PRNG utilities. Every player gets the same
 *  daily puzzle because everything derives from the date string. */

/** Hash a string into a 32-bit unsigned integer (FNV-style). */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, fast, good-enough PRNG for game generation. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG deterministically derived from a date key + salt. */
export function createDailyRng(dateKey: string, salt = ""): () => number {
  return mulberry32(hashSeed(`${dateKey}:${salt}`));
}

/** Random index into a list. */
export function pickIndex(rng: () => number, length: number): number {
  return Math.floor(rng() * length);
}

/** Fisher–Yates shuffle (non-mutating). */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
