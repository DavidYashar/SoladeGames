/**
 * Tower layout for the pull game.
 *
 * 18 layers of 3 planks, each layer rotated 90 degrees from the one below, which is
 * the classic interlocking bond. Plank proportions are the real ones (75 x 25 x 15 mm),
 * scaled to 3.0 x 1.0 x 0.6 world units.
 */

export const PLANK = { l: 3.0, w: 1.0, h: 0.6 } as const;
export const GAP = 0.03;
export const LAYERS = 18;

export interface PlankSpec {
  id: number;
  layer: number;
  slot: number;
  /** True when the plank's long axis runs along X, false when along Z. */
  alongX: boolean;
  x: number;
  y: number;
  z: number;
}

/** Every plank in the starting tower, bottom layer first. */
export function layout(): PlankSpec[] {
  const out: PlankSpec[] = [];
  let id = 0;

  for (let layer = 0; layer < LAYERS; layer++) {
    const alongX = layer % 2 === 0;
    const y = PLANK.h / 2 + layer * PLANK.h;

    for (let slot = 0; slot < 3; slot++) {
      const offset = (slot - 1) * (PLANK.w + GAP);
      out.push({
        id: id++,
        layer,
        slot,
        alongX,
        x: alongX ? 0 : offset,
        y,
        z: alongX ? offset : 0,
      });
    }
  }

  return out;
}

export function halfExtents(alongX: boolean) {
  return alongX
    ? { x: PLANK.l / 2, y: PLANK.h / 2, z: PLANK.w / 2 }
    : { x: PLANK.w / 2, y: PLANK.h / 2, z: PLANK.l / 2 };
}

/** How far a plank travels to leave the tower, along its own long axis. */
export const PULL_DISTANCE = PLANK.l + 0.35;
/** Seconds the extraction takes. Short enough to feel decisive, long enough that the
 *  load above can redistribute instead of the solver taking one huge impulse. */
export const PULL_SECONDS = 0.7;

/** The top layer cannot be touched. */
export function isTopLayer(layer: number): boolean {
  return layer >= LAYERS - 1;
}
