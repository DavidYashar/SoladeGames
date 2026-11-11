import { createDailyRng } from "@/lib/puzzles/rng";

export const BUBBLE_COLORS = 5;
export const COLS = 9;
export const STARTING_SHOTS = 46;

/** Bubble variants. `normal` is the standard matched color bubble. */
export type BubbleKind = "normal" | "ice" | "stone" | "bomb" | "gold" | "rainbow";

export interface FieldBubble {
  row: number;
  col: number;
  color: number; // index into the palette
  kind: BubbleKind;
  hits: number; // for ice: 2 = frozen, 1 = cracked
}

export interface BubblePopSeed {
  field: FieldBubble[];
  queue: number[]; // shooter color sequence
  shots: number; // starting shot budget
}

/**
 * Deterministic per-day bubble field + shooter sequence for Bubble Pop.
 * Identical board for every player on the same date — tournament-fair.
 */
export function bubblePopForDay(dateKey: string): BubblePopSeed {
  const rng = createDailyRng(dateKey, "bubble-pop");
  const field: FieldBubble[] = [];

  /** Weighted chance for a special bubble per occupied cell. */
  const specials: { kind: BubbleKind; w: number; color: number }[] = [
    { kind: "ice", w: 0.055, color: 0 },
    { kind: "stone", w: 0.045, color: 2 },
    { kind: "bomb", w: 0.035, color: 4 },
    { kind: "gold", w: 0.03, color: 1 },
    { kind: "rainbow", w: 0.022, color: 0 },
  ];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < COLS; c++) {
      if (rng() < 0.15) continue; // seeded gaps
      const color = Math.floor(rng() * BUBBLE_COLORS);
      const roll = rng();
      let kind: BubbleKind = "normal";
      let hits = 1;
      let acc = 0;
      for (const s of specials) {
        acc += s.w;
        if (roll < acc) {
          kind = s.kind;
          if (kind === "ice") hits = 2;
          break;
        }
      }
      field.push({ row: r, col: c, color, kind, hits });
    }
  }

  const queue = Array.from(
    { length: 300 },
    () => Math.floor(rng() * BUBBLE_COLORS),
  );
  return { field, queue, shots: STARTING_SHOTS };
}
