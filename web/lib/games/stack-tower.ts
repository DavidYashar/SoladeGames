import { createDailyRng } from "@/lib/puzzles/rng";

export type StackKind = "normal" | "gold" | "bomb" | "stone";

export interface BlockSpec {
  dir: 1 | -1;
  speed: number; // px per second
  kind: StackKind;
}

const BASE_SPEED = 70;
const MAX_SPEED = 230;
const BOMB_WEIGHT = 0.1;
const GOLD_WEIGHT = 0.09;
const STONE_WEIGHT = 0.07;

/**
 * Deterministic per-day block sequence for Stack Tower.
 * Every player on the same date gets the identical speed/direction stream,
 * so daily tournaments compare players on the exact same board.
 */
export function stackSpecsForDay(dateKey: string, count: number): BlockSpec[] {
  const rng = createDailyRng(dateKey, "stack-tower");
  const specs: BlockSpec[] = [];
  for (let i = 0; i < count; i++) {
    const dir = rng() < 0.5 ? 1 : -1;
    const speed = Math.min(
      MAX_SPEED,
      BASE_SPEED + Math.floor(rng() * 80) + i * 2,
    );
    const roll = rng();
    let kind: StackKind = "normal";
    if (roll < BOMB_WEIGHT) kind = "bomb";
    else if (roll < BOMB_WEIGHT + GOLD_WEIGHT) kind = "gold";
    else if (roll < BOMB_WEIGHT + GOLD_WEIGHT + STONE_WEIGHT) kind = "stone";
    specs.push({ dir, speed, kind });
  }
  return specs;
}
