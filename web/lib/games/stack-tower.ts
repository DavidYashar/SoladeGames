import { createDailyRng } from "@/lib/puzzles/rng";

/**
 * Stack Tower rules, kept pure so the simulation is testable and the renderer stays
 * dumb. See docs/GAME-RULES.md section 1 for the source of every constant here.
 */

export type StackKind = "normal" | "gold" | "bomb" | "stone";

export interface BlockSpec {
  dir: 1 | -1;
  /** Logical px per second, as the original cabinets measured it. */
  speed: number;
  kind: StackKind;
}

/** Logical field the rules were tuned against. */
export const FIELD = { w: 360, h: 540, blockH: 28, baseW: 180, perfectPx: 3 } as const;

export const COMBO_MAX = 5;
export const MILESTONE = 20;

/** Logical field units to world units, so the frame's window is exactly 6 x 9. */
export const SCALE = 1 / 60;
export const FIELD_W = FIELD.w * SCALE; // 6
export const FIELD_H = FIELD.h * SCALE; // 9
export const BLOCK_H = FIELD.blockH * SCALE;
export const BASE_W = FIELD.baseW * SCALE;

const BASE_SPEED = 70;
const MAX_SPEED = 230;
const BOMB_WEIGHT = 0.1;
const GOLD_WEIGHT = 0.09;
const STONE_WEIGHT = 0.07;

/** Deterministic per-day block stream: direction, speed and kind. */
export function stackSpecsForDay(dateKey: string, count = 400): BlockSpec[] {
  const rng = createDailyRng(dateKey, "stack-tower");
  const specs: BlockSpec[] = [];
  for (let i = 0; i < count; i++) {
    const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
    // Speed is rounded to whole px/s so the world position stays stable in float32.
    const speed = Math.round(Math.min(MAX_SPEED, BASE_SPEED + Math.floor(rng() * 80) + i * 2));
    const roll = rng();
    let kind: StackKind = "normal";
    if (roll < BOMB_WEIGHT) kind = "bomb";
    else if (roll < BOMB_WEIGHT + GOLD_WEIGHT) kind = "gold";
    else if (roll < BOMB_WEIGHT + GOLD_WEIGHT + STONE_WEIGHT) kind = "stone";
    specs.push({ dir, speed, kind });
  }
  return specs;
}

export interface Stack {
  x: number;
  w: number;
}

export interface Placement {
  /** New block, or null when the drop missed. */
  block: Stack | null;
  perfect: boolean;
  gained: number;
  combo: number;
  streak: number;
}

/**
 * Resolve one drop. All values are world units; the caller converts.
 * Order matters: the perfect-width rule runs first, then the block kind adjusts it.
 */
export function resolvePlacement(
  prev: Stack,
  cur: Stack,
  kind: StackKind,
  comboIn: number,
  streakIn: number,
): Placement {
  const left = Math.max(prev.x, cur.x);
  const right = Math.min(prev.x + prev.w, cur.x + cur.w);
  const overlap = right - left;

  if (overlap <= 0) {
    return { block: null, perfect: false, gained: 0, combo: 1, streak: 0 };
  }

  const centerDiff = Math.abs(
    cur.x + cur.w / 2 - (prev.x + prev.w / 2),
  );
  const perfect = centerDiff <= FIELD.perfectPx * SCALE;

  let combo = comboIn;
  let streak = streakIn;
  if (perfect) {
    streak += 1;
    combo = Math.min(COMBO_MAX, 1 + Math.floor(streak / 3));
  } else {
    streak = 0;
    combo = 1;
  }

  let w = perfect ? prev.w : overlap;
  let bonus = 0;

  if (kind === "stone") {
    if (w < prev.w) w = Math.max(w, prev.w * 0.75);
    bonus += 2;
  } else if (kind === "gold") {
    w = Math.min(BASE_W, prev.w + 14 * SCALE);
    bonus += 5;
  } else if (kind === "bomb") {
    w = Math.max(6 * SCALE, w * 0.7);
  }

  const gained = 1 + bonus + combo - 1;
  return { block: { x: left, w }, perfect, gained, combo, streak };
}
