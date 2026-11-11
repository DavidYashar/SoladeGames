/**
 * The opponent's decision model.
 *
 * This is arithmetic, not learning. Every move is scored from the tower's geometry:
 * where the mass above a plank sits, how much support is left if the plank goes, and
 * how much load that plank is carrying. The same position always produces the same
 * choice, which is what makes the opponent testable and replayable.
 */

import { LAYERS, PLANK, isTopLayer } from "./tower";
import type { JengaSim, Placement } from "./sim";

export interface ScoredMove {
  plankId: number;
  layer: number;
  slot: number;
  /** Predicted outcome numbers, kept for display and debugging. */
  margin: number;
  massAbove: number;
  supportLeft: number;
  risk: number;
}

/** Half extents in the horizontal plane, for support arithmetic. */
function footprint(alongX: boolean) {
  return alongX
    ? { hx: PLANK.l / 2, hz: PLANK.w / 2 }
    : { hx: PLANK.w / 2, hz: PLANK.l / 2 };
}

interface Above {
  comX: number;
  comZ: number;
  count: number;
}

/** Centre of mass of every plank above a given layer, assuming equal mass. */
function massAbove(sim: JengaSim, layer: number): Above {
  let x = 0;
  let z = 0;
  let count = 0;
  for (const p of sim.planks) {
    if (p.removed || p.layer <= layer) continue;
    x += p.x;
    z += p.z;
    count += 1;
  }
  return count === 0 ? { comX: 0, comZ: 0, count: 0 } : { comX: x / count, comZ: z / count, count };
}

/**
 * The support footprint left in a layer once one plank is taken out.
 * The planks above act as a plate, so the hull is the bounding rectangle of the
 * remaining planks rather than a set of disconnected strips.
 */
function supportBounds(sim: JengaSim, layer: number, excludeId: number) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let count = 0;

  for (const p of sim.planks) {
    if (p.removed || p.layer !== layer || p.id === excludeId) continue;
    const { hx, hz } = footprint(p.alongX);
    minX = Math.min(minX, p.x - hx);
    maxX = Math.max(maxX, p.x + hx);
    minZ = Math.min(minZ, p.z - hz);
    maxZ = Math.max(maxZ, p.z + hz);
    count += 1;
  }

  return count === 0 ? null : { minX, maxX, minZ, maxZ, count };
}

/**
 * Scores every plank the rules allow. Lower risk is safer.
 *
 * The weights are the model. A negative margin means the mass above no longer sits
 * over anything, which is a certain collapse and is ranked last regardless.
 */
export function rankMoves(sim: JengaSim, limit = 6): ScoredMove[] {
  const moves: ScoredMove[] = [];

  for (const plank of sim.planks) {
    if (plank.removed || isTopLayer(plank.layer)) continue;

    const leftInLayer = sim.planks.filter(
      (p) => p.layer === plank.layer && !p.removed && p.id !== plank.id,
    ).length;
    if (leftInLayer === 0) continue;

    const bounds = supportBounds(sim, plank.layer, plank.id);
    if (!bounds) continue;

    const above = massAbove(sim, plank.layer);
    const margin = Math.min(
      above.comX - bounds.minX,
      bounds.maxX - above.comX,
      above.comZ - bounds.minZ,
      bounds.maxZ - above.comZ,
    );

    // Higher layers carry less, so they are cheaper to disturb.
    const heightFactor = plank.layer / Math.max(1, LAYERS - 1);
    const load = above.count / 54;

    let risk = 0;
    risk -= margin * 2.2; // a wide margin is the single best predictor of survival
    risk += load * 3.0; // more mass above, more to lose
    risk += (3 - leftInLayer) * 1.1; // a layer down to one plank is fragile
    risk -= heightFactor * 1.6; // pulling high is safer
    if (margin < 0) risk += 1000; // unsupported: never choose it

    moves.push({
      plankId: plank.id,
      layer: plank.layer,
      slot: plank.slot,
      margin: Number(margin.toFixed(3)),
      massAbove: above.count,
      supportLeft: leftInLayer,
      risk: Number(risk.toFixed(3)),
    });
  }

  return moves.sort((a, b) => a.risk - b.risk).slice(0, limit);
}

/**
 * Placement choice. Keep the mass centred and, on a fresh layer, lay the plank
 * across the one below so the bond stays interlocked.
 */
export function choosePlacement(sim: JengaSim, options: Placement[]): Placement {
  if (options.length === 0) throw new Error("no placement options");

  const top = sim.topLayer();
  const topPlanks = sim.planks.filter((p) => p.layer === top && !p.removed);
  const topAlongX = topPlanks.length > 0 ? topPlanks[0].alongX : null;

  const score = (o: Placement) => {
    let s = 0;
    // Centred is best: slot 1 sits over the middle of the tower.
    s -= Math.abs(o.slot - 1) * 2;
    // On a new layer, crossing the layer below locks the tower.
    if (o.layer > top && topAlongX !== null) s += o.alongX !== topAlongX ? 3 : 0;
    return s;
  };

  return options.reduce((best, o) => (score(o) > score(best) ? o : best), options[0]);
}

/** The opponent's whole turn, as plain functions. */
export function choosePull(sim: JengaSim): ScoredMove | null {
  const ranked = rankMoves(sim, 1);
  return ranked.length > 0 ? ranked[0] : null;
}
