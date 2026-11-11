/**
 * The opponent's decision model.
 *
 * No learning, no randomness. Two stages, both arithmetic:
 *
 *  1. Rank every legal plank by a closed-form risk score built from the tower's
 *     CURRENT geometry: where the mass above sits relative to the support left behind.
 *  2. Verify the best few by actually simulating the removal on a snapshot and
 *     restoring. Only moves that leave the tower still are considered.
 *
 * Stage 2 is what makes it hard to beat: the formula can be wrong about a particular
 * tower, but the probe cannot, because it is the same solver the game runs on.
 */

import { LAYERS, PLANK, isTopLayer } from "./tower";
import type { JengaSim, Placement } from "./sim";
import type { Pose } from "./state";

export interface ScoredMove {
  plankId: number;
  layer: number;
  slot: number;
  margin: number;
  massAbove: number;
  supportLeft: number;
  risk: number;
  /** Filled in by the verification stage. */
  probeDisp: number | null;
  probeFallen: number | null;
}

function footprint(alongX: boolean) {
  return alongX
    ? { hx: PLANK.l / 2, hz: PLANK.w / 2 }
    : { hx: PLANK.w / 2, hz: PLANK.l / 2 };
}

function massAbove(
  sim: JengaSim,
  poses: Map<number, Pose>,
  layer: number,
): { comX: number; comZ: number; count: number } {
  let x = 0;
  let z = 0;
  let count = 0;
  for (const p of sim.planks) {
    if (p.removed || p.layer <= layer) continue;
    const pose = poses.get(p.id);
    if (!pose) continue;
    x += pose.x;
    z += pose.z;
    count += 1;
  }
  return count === 0
    ? { comX: 0, comZ: 0, count: 0 }
    : { comX: x / count, comZ: z / count, count };
}

function supportBounds(
  sim: JengaSim,
  poses: Map<number, Pose>,
  layer: number,
  excludeId: number,
) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let count = 0;

  for (const p of sim.planks) {
    if (p.removed || p.layer !== layer || p.id === excludeId) continue;
    const pose = poses.get(p.id);
    if (!pose) continue;
    const { hx, hz } = footprint(p.alongX);
    minX = Math.min(minX, pose.x - hx);
    maxX = Math.max(maxX, pose.x + hx);
    minZ = Math.min(minZ, pose.z - hz);
    maxZ = Math.max(maxZ, pose.z + hz);
    count += 1;
  }

  return count === 0 ? null : { minX, maxX, minZ, maxZ, count };
}

/**
 * The worst support margin anywhere in a given tower state. This is the number the
 * opponent maximizes: not "how little did it move", but "how well supported is the
 * tower I am leaving behind".
 */
export function worstMargin(
  sim: JengaSim,
  poses: Map<number, Pose>,
  excludeId: number,
): number {
  let worst = Infinity;

  for (const p of sim.planks) {
    if (p.removed || p.id === excludeId) continue;
    const pose = poses.get(p.id);
    if (!pose || pose.y < -0.9) continue;

    const above = massAbove(sim, poses, p.layer);
    if (above.count === 0) continue;

    const bounds = supportBounds(sim, poses, p.layer, excludeId);
    if (!bounds) return -Infinity;

    const margin = Math.min(
      above.comX - bounds.minX,
      bounds.maxX - above.comX,
      above.comZ - bounds.minZ,
      bounds.maxZ - above.comZ,
    );
    worst = Math.min(worst, margin);
  }

  return worst === Infinity ? 0 : Number(worst.toFixed(3));
}
/** Closed-form ranking, read from live body positions. */
export function rankMoves(sim: JengaSim, limit = 8): ScoredMove[] {
  const poses = sim.livePoses();
  const moves: ScoredMove[] = [];

  for (const plank of sim.planks) {
    if (plank.removed || isTopLayer(plank.layer)) continue;

    const leftInLayer = sim.planks.filter(
      (p) => p.layer === plank.layer && !p.removed && p.id !== plank.id,
    ).length;
    if (leftInLayer === 0) continue;

    const bounds = supportBounds(sim, poses, plank.layer, plank.id);
    const above = massAbove(sim, poses, plank.layer);
    if (!bounds) continue;

    const margin = Math.min(
      above.comX - bounds.minX,
      bounds.maxX - above.comX,
      above.comZ - bounds.minZ,
      bounds.maxZ - above.comZ,
    );

    const heightFactor = plank.layer / Math.max(1, LAYERS - 1);
    const load = above.count / 54;

    let risk = 0;
    risk -= margin * 2.2;
    risk += load * 3.0;
    risk += (3 - leftInLayer) * 1.1;
    risk -= heightFactor * 1.6;
    if (margin < 0) risk += 1000;

    moves.push({
      plankId: plank.id,
      layer: plank.layer,
      slot: plank.slot,
      margin: Number(margin.toFixed(3)),
      massAbove: above.count,
      supportLeft: leftInLayer,
      risk: Number(risk.toFixed(3)),
      probeDisp: null,
      probeFallen: null,
    });
  }

  return moves.sort((a, b) => a.risk - b.risk).slice(0, limit);
}

/**
 * Ranking plus verification. Every candidate is simulated on a snapshot; the winner
 * is the move that disturbs the tower least, with the formula as tie-break.
 */
export function chooseVerifiedMove(sim: JengaSim, ticks = 45): ScoredMove | null {
  // Eight candidates, 45 ticks each. Tried 4x30 to speed it up and it lost two of two
  // runs, so the depth is load-bearing: shallow probes miss slow collapses.
  const ranked = rankMoves(sim, 8);
  if (ranked.length === 0) return null;

  const probed = ranked.map((move) => {
    const result = sim.probe(move.plankId, ticks);
    const after = worstMargin(sim, result.poses, move.plankId);
    return {
      ...move,
      probeDisp: result.maxDisp,
      probeFallen: result.fallen,
      afterMargin: after,
    };
  });

  // A move survives only if nothing fell AND the tower it leaves is still supported.
  const safe = probed.filter(
    (m) => m.probeFallen === 0 && (m.probeDisp ?? 1) < 0.5 && (m.afterMargin ?? -Infinity) > 0.15,
  );
  const pool = safe.length > 0 ? safe : probed;

  // Maximize the stability of the resulting tower; break ties by the closed-form risk.
  pool.sort((a, b) => {
    const d = (b.afterMargin ?? -Infinity) - (a.afterMargin ?? -Infinity);
    return Math.abs(d) > 0.02 ? d : a.risk - b.risk;
  });

  return pool[0];
}

/** Placement choice: centred, and across the layer below on a fresh layer. */
export function choosePlacement(sim: JengaSim, options: Placement[]): Placement {
  if (options.length === 0) throw new Error("no placement options");

  const top = sim.topLayer();
  const topPlanks = sim.planks.filter((p) => p.layer === top && !p.removed);
  const topAlongX = topPlanks.length > 0 ? topPlanks[0].alongX : null;

  const score = (o: Placement) => {
    let s = 0;
    s -= Math.abs(o.slot - 1) * 2;
    if (o.layer > top && topAlongX !== null) s += o.alongX !== topAlongX ? 3 : 0;
    return s;
  };

  return options.reduce((best, o) => (score(o) > score(best) ? o : best), options[0]);
}
