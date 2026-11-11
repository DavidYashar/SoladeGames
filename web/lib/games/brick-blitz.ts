import { createDailyRng } from "@/lib/puzzles/rng";

export type BrickKind =
  | "normal"
  | "armored"
  | "steel"
  | "gold"
  | "bomb"
  | "moving"
  | "rainbow";

export type PowerKind =
  | "expand"
  | "multi"
  | "laser"
  | "fire"
  | "slow"
  | "fast"
  | "life";

export interface BrickSpec {
  c: number; // column
  r: number; // row
  hp: number; // hits to break (1, 2, or 3)
  points: number;
  hue: number;
  kind: BrickKind;
  pu: PowerKind | null; // drops this power-up when broken
}

/**
 * Deterministic per-day brick wall for Brick Blitz (wave-indexed so each
 * cleared wave is a fresh, fair layout). Identical for every player.
 */
export function brickLayoutForDay(dateKey: string, wave = 1): BrickSpec[] {
  const rng = createDailyRng(dateKey + ":" + wave, "brick-blitz");
  const bricks: BrickSpec[] = [];

  const specials: { kind: BrickKind; w: number; hp: number; points: number }[] = [
    { kind: "armored", w: 0.14, hp: 3, points: 30 },
    { kind: "gold", w: 0.09, hp: 1, points: 100 },
    { kind: "bomb", w: 0.07, hp: 1, points: 20 },
    { kind: "moving", w: 0.08, hp: 1, points: 25 },
    { kind: "rainbow", w: 0.07, hp: 1, points: 20 },
    { kind: "steel", w: 0.05, hp: 999, points: 0 },
  ];

  const powerPool: PowerKind[] = [
    "expand",
    "multi",
    "laser",
    "fire",
    "slow",
    "fast",
    "life",
  ];

  // More gaps get filled at higher waves (denser walls).
  const gapChance = Math.max(0.02, 0.14 - (wave - 1) * 0.03);

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 8; c++) {
      if (rng() < gapChance) continue; // seeded gaps
      const roll = rng();
      let kind: BrickKind = "normal";
      let hp = 1;
      let points = 10 + Math.floor(rng() * 3) * 10;
      let acc = 0;
      for (const s of specials) {
        acc += s.w;
        if (roll < acc) {
          kind = s.kind;
          hp = s.hp;
          if (s.kind === "normal") points = s.points;
          else if (s.points > 0) points = s.points;
          break;
        }
      }
      const hue = (195 + r * 22 + Math.floor(rng() * 3) * 8) % 360;
      // ~1 in 8 bricks carries a power-up, more at higher waves.
      const pu = rng() < Math.min(0.22, 0.1 + (wave - 1) * 0.04)
        ? powerPool[Math.floor(rng() * powerPool.length)]
        : null;
      bricks.push({ c, r, hp, points, hue, kind, pu });
    }
  }
  return bricks;
}
