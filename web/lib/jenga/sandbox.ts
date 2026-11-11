/**
 * Sandbox experiment: does an 18-layer tower stand, and how often does a random
 * extraction bring it down?
 *
 * This is the gate everything else depends on. It runs headless through the same
 * simulation the browser uses, so the numbers describe the game we will ship.
 */

import { JengaSim } from "./sim";
import { choosePlacement, chooseVerifiedMove } from "./policy";
import { LAYERS, isTopLayer } from "./tower";

/** Small deterministic PRNG so a run can be repeated exactly. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PullLog {
  pull: number;
  plank: number;
  layer: number;
  fallen: number;
  displacement: number;
  settledTicks: number;
  worst: { id: number; layer: number; d: number }[];
}

export interface TrialResult {
  trial: number;
  settledAtStart: boolean;
  startDisplacement: number;
  collapsedAt: number | null;
  pulls: PullLog[];
}

export interface SandboxReport {
  trials: number;
  pullsPerTrial: number;
  layers: number;
  planks: number;
  /** Trials where the untouched tower fell apart on its own. Must be zero. */
  selfCollapses: number;
  /** Mean number of successful pulls before collapse, ignoring trials that survived. */
  meanSurvivedPulls: number;
  /** Trials that survived every requested pull. */
  survivors: number;
  results: TrialResult[];
}

/**
 * Same experiment, but both sides play the math model. This is how the opponent is
 * judged: if it cannot outlast random play, the weights are wrong.
 */
export async function runPolicySandbox(trials = 4, turns = 40, randomize = false, mixed = false): Promise<{
  trials: number;
  turns: number;
  collapses: number;
  meanTurnsSurvived: number;
  perTrial: { trial: number; collapsedAt: number | null }[];
}> {
  let survived = 0;
  let collapsed = 0;
  const perTrial: { trial: number; collapsedAt: number | null }[] = [];

  for (let trial = 0; trial < trials; trial++) {
    const sim = await JengaSim.create();
    sim.settle(3.0);
    const baseline = sim.fallen().length;
    let collapsedAt: number | null = null;

    for (let t = 0; t < turns; t++) {
      const playerTurn = t % 2 === 0;
      const useRandom = randomize || (mixed && playerTurn);

      if (useRandom) {
        const legal = sim.planks.filter((p) => !p.removed && p.layer < 17 &&
          sim.planks.filter((q) => q.layer === p.layer && !q.removed).length > 1);
        if (legal.length === 0) break;
        sim.beginPull(legal[Math.floor(Math.random() * legal.length)].id, 1);
      } else {
        const move = chooseVerifiedMove(sim);
        if (!move) break;
        sim.beginPull(move.plankId, 1);
      }
      sim.settle(2.2);
      if (sim.fallen().length > baseline) {
        collapsedAt = t + 1;
        break;
      }
      const options = sim.placementOptions();
      if (options.length === 0) break;
      sim.place(useRandom ? options[Math.floor(Math.random() * options.length)] : choosePlacement(sim, options));
      sim.settle(2.2);
      if (sim.fallen().length > baseline) {
        collapsedAt = t + 1;
        break;
      }
    }

    if (collapsedAt === null) survived += turns;
    else {
      collapsed += 1;
      survived += collapsedAt - 1;
    }
    perTrial.push({ trial, collapsedAt });
  }

  return {
    trials,
    turns,
    collapses: collapsed,
    meanTurnsSurvived: Number((survived / (collapsed + (trials - collapsed) || 1)).toFixed(2)),
    perTrial,
  };
}

export async function runSandbox(
  trials = 6,
  pullsPerTrial = 24,
  seed = 20261111,
): Promise<SandboxReport> {
  const random = rng(seed);
  const results: TrialResult[] = [];
  let selfCollapses = 0;
  let survivors = 0;
  let survivedSum = 0;
  let collapsedCount = 0;

  for (let trial = 0; trial < trials; trial++) {
    const sim = await JengaSim.create();

    // Let the untouched tower come to rest before judging anything.
    sim.settle(3.0);
    const fallenAtStart = sim.fallen().length;
    const startDisplacement = sim.maxDisplacement();
    const settledAtStart = fallenAtStart === 0;
    if (!settledAtStart) selfCollapses += 1;

    let collapsedAt: number | null = null;
    const pulls: PullLog[] = [];

    for (let i = 0; i < pullsPerTrial; i++) {
      const legal = sim.planks.filter((p) => {
        if (p.removed) return false;
        if (isTopLayer(p.layer)) return false;
        const left = sim.planks.filter((q) => q.layer === p.layer && !q.removed).length;
        return left > 1;
      });
      if (legal.length === 0) break;

      const target = legal[Math.floor(random() * legal.length)];
      const dir: 1 | -1 = random() < 0.5 ? 1 : -1;

      sim.beginPull(target.id, dir);
      const ticks = sim.settle(0.9);

      const fallen = sim.fallen().length;
      pulls.push({
        pull: i + 1,
        plank: target.id,
        layer: target.layer,
        fallen,
        displacement: Number(sim.maxDisplacement().toFixed(3)),
        settledTicks: ticks,
        worst: sim.displacementReport(3).map((r) => ({ ...r, d: Number(r.d.toFixed(2)) })),
      });

      if (fallen > fallenAtStart) {
        collapsedAt = i + 1;
        break;
      }
    }

    if (collapsedAt === null) {
      survivors += 1;
      survivedSum += pulls.length;
    } else {
      collapsedCount += 1;
      survivedSum += collapsedAt - 1;
    }

    results.push({
      trial,
      settledAtStart,
      startDisplacement: Number(startDisplacement.toFixed(4)),
      collapsedAt,
      pulls,
    });
  }

  return {
    trials,
    pullsPerTrial,
    layers: LAYERS,
    planks: 54,
    selfCollapses,
    meanSurvivedPulls:
      trials > 0 ? Number((survivedSum / (collapsedCount + survivors || 1)).toFixed(2)) : 0,
    survivors,
    results,
  };
}
