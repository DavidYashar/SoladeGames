/**
 * Physics simulation for the tower. Framework-free on purpose: the browser renders
 * this, and the sandbox experiment runs the exact same code under Node.
 */

import RAPIER from "@dimforge/rapier3d-compat";

import { capture, restore, type Pose } from "./state";
import {
  GAP,
  PULL_DISTANCE,
  PULL_SECONDS,
  halfExtents,
  isTopLayer,
  layout,
  PLANK,
  type PlankSpec,
} from "./tower";

export const DT = 1 / 120;

/** Gravity in world units. Planks are 3 units long, so this is a soft, readable fall. */
const GRAVITY = { x: 0, y: -18, z: 0 };

export interface PlankState extends PlankSpec {
  removed: boolean;
}

let rapierReady: Promise<void> | null = null;

export function initRapier(): Promise<void> {
  if (!rapierReady) rapierReady = RAPIER.init();
  return rapierReady;
}

interface PullState {
  id: number;
  t: number;
  dir: 1 | -1;
  from: { x: number; y: number; z: number };
  alongX: boolean;
}

export interface Placement {
  layer: number;
  alongX: boolean;
  slot: number;
  x: number;
  y: number;
  z: number;
}
export class JengaSim {
  world: RAPIER.World;
  planks: PlankState[];
  time = 0;

  private bodies = new Map<number, RAPIER.RigidBody>();
  private start = new Map<number, { x: number; y: number; z: number }>();
  private pull: PullState | null = null;
  private nextId = 1000;

  private constructor(world: RAPIER.World, planks: PlankState[]) {
    this.world = world;
    this.planks = planks;
  }

  static async create(): Promise<JengaSim> {
    await initRapier();

    const world = new RAPIER.World(GRAVITY);
    world.timestep = DT;

    // Stacking needs more solver work than the default; without it a tall tower sinks.
    try {
      const ip = world.integrationParameters as unknown as Record<string, unknown>;
      if ("numSolverIterations" in ip) ip.numSolverIterations = 12;
      if ("numAdditionalFrictionIterations" in ip) ip.numAdditionalFrictionIterations = 6;
    } catch {
      // Older builds expose different knobs; defaults still work.
    }

    // Table.
    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(12, 0.25, 12)
        .setTranslation(0, -0.25, 0)
        .setFriction(0.8),
      groundBody,
    );

    const planks: PlankState[] = layout().map((p) => ({ ...p, removed: false }));
    const sim = new JengaSim(world, planks);

    for (const p of planks) {
      const he = halfExtents(p.alongX);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(p.x, p.y, p.z)
          .setLinearDamping(0.08)
          .setAngularDamping(0.35),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
          .setFriction(0.72)
          .setRestitution(0.02)
          .setDensity(0.8),
        body,
      );
      sim.bodies.set(p.id, body);
      sim.start.set(p.id, { x: p.x, y: p.y, z: p.z });
    }

    return sim;
  }

  get pulling(): boolean {
    return this.pull !== null;
  }

  private plank(id: number): PlankState | undefined {
    return this.planks.find((p) => p.id === id);
  }

  private body(id: number): RAPIER.RigidBody | undefined {
    return this.bodies.get(id);
  }


  /**
   * Free placement: the player carries the plank and releases it anywhere over the
   * tower, in whichever orientation they rotated to.
   */
  placeFree(x: number, z: number, alongX: boolean): Placement {
    const top = this.topLayer();
    const inTop = this.planks.filter((p) => p.layer === top && !p.removed);
    const sameOrientation = inTop.length > 0 && inTop.every((p) => p.alongX === alongX);
    const layer = inTop.length > 0 && inTop.length < 3 && sameOrientation ? top : top + 1;
    const y = PLANK.h / 2 + layer * PLANK.h;

    const perpendicular = alongX ? z : x;
    const slot = perpendicular < -0.5 ? 0 : perpendicular > 0.5 ? 2 : 1;

    const placement: Placement = { layer, alongX, slot, x, y, z };
    this.place(placement);
    return placement;
  }
  /** Highest layer that still has a plank in it. */
  topLayer(): number {
    let top = 0;
    for (const p of this.planks) {
      if (!p.removed && p.layer > top) top = p.layer;
    }
    return top;
  }

  /**
   * Where the extracted plank may go. A half-filled top layer offers its free slots in
   * that layer's orientation; a full top layer opens a new one, where both orientations
   * and all three positions are available.
   */
  placementOptions(): Placement[] {
    const top = this.topLayer();
    const inTop = this.planks.filter((p) => p.layer === top && !p.removed);
    const out: Placement[] = [];

    const push = (layer: number, alongX: boolean, slot: number) => {
      const offset = (slot - 1) * (PLANK.w + GAP);
      out.push({
        layer,
        alongX,
        slot,
        x: alongX ? 0 : offset,
        y: PLANK.h / 2 + layer * PLANK.h,
        z: alongX ? offset : 0,
      });
    };

    if (inTop.length > 0 && inTop.length < 3) {
      const alongX = inTop[0].alongX;
      const taken = new Set(inTop.map((p) => p.slot));
      for (let slot = 0; slot < 3; slot++) {
        if (!taken.has(slot)) push(top, alongX, slot);
      }
      return out;
    }

    const layer = inTop.length === 0 ? top : top + 1;
    for (const alongX of [true, false]) {
      for (let slot = 0; slot < 3; slot++) push(layer, alongX, slot);
    }
    return out;
  }

  /** Drops a plank into one of the offered placements. */
  place(opt: Placement): boolean {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(opt.x, opt.y, opt.z)
        .setLinearDamping(0.08)
        .setAngularDamping(0.35),
    );
    const he = halfExtents(opt.alongX);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
        .setFriction(0.72)
        .setRestitution(0.02)
        .setDensity(0.8),
      body,
    );

    const id = this.nextId++;
    this.bodies.set(id, body);
    this.start.set(id, { x: opt.x, y: opt.y, z: opt.z });
    this.planks.push({
      id,
      layer: opt.layer,
      slot: opt.slot,
      alongX: opt.alongX,
      x: opt.x,
      y: opt.y,
      z: opt.z,
      removed: false,
    });
    return true;
  }
  /** One fixed physics step, including any extraction in progress. */
  step(): void {
    if (this.pull) {
      const body = this.body(this.pull.id);
      if (body) {
        this.pull.t += DT / PULL_SECONDS;
        const k = Math.min(1, this.pull.t);
        const travel = PULL_DISTANCE * k;
        body.setNextKinematicTranslation({
          x: this.pull.from.x + (this.pull.alongX ? this.pull.dir * travel : 0),
          y: this.pull.from.y,
          z: this.pull.from.z + (this.pull.alongX ? 0 : this.pull.dir * travel),
        });

        if (k >= 1) {
          this.world.removeRigidBody(body);
          this.bodies.delete(this.pull.id);
          const p = this.plank(this.pull.id);
          if (p) p.removed = true;
          this.pull = null;
        }
      } else {
        this.pull = null;
      }
    }

    this.world.step();
    this.time += DT;
  }

  /**
   * Starts an extraction. `dir` picks which end the plank leaves by.
   * The plank becomes kinematic, so it pushes neighbours aside while sliding out
   * instead of vanishing and spiking the solver with an instant load change.
   */
  beginPull(id: number, dir: 1 | -1 = 1): boolean {
    if (this.pull) return false;
    const p = this.plank(id);
    const body = this.body(id);
    if (!p || !body || p.removed) return false;
    if (isTopLayer(p.layer)) return false;

    const layerPlanks = this.planks.filter((q) => q.layer === p.layer && !q.removed);
    if (layerPlanks.length <= 1) return false;

    const t = body.translation();
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    // A kinematic body has infinite mass, so wood-on-wood friction would let it fling
    // the planks resting on it. Make the plank being extracted slick: it still
    // carries load while it slides, but it cannot drag its neighbours along.
    const collider = body.collider(0);
    if (collider) {
      collider.setFriction(0.04);
      collider.setRestitution(0);
      // The extracted plank stops colliding the moment it starts to slide. A kinematic
      // body has infinite mass and would otherwise shove its neighbours, which the
      // sandbox measured as planks being thrown metres away. A sensor keeps the load
      // redistribution honest (the remaining planks carry it) without the shove.
      collider.setSensor(true);
    }
    this.pull = {
      id,
      t: 0,
      dir,
      from: { x: t.x, y: t.y, z: t.z },
      alongX: p.alongX,
    };
    return true;
  }

  /** Steps until everything is still, or the budget runs out. Returns ticks used. */
  settle(maxSeconds = 2.0): number {
    const maxTicks = Math.ceil(maxSeconds / DT);
    for (let i = 0; i < maxTicks; i++) {
      // An extraction in flight always needs ticks, even if every body is asleep.
      if (!this.pull && this.isAsleep()) return i;
      this.step();
    }
    return maxTicks;
  }

  private isAsleep(): boolean {
    for (const body of this.bodies.values()) {
      if (body.isSleeping()) continue;
      const v = body.linvel();
      const w = body.angvel();
      if (Math.hypot(v.x, v.y, v.z) > 0.35) return false;
      if (Math.hypot(w.x, w.y, w.z) > 0.6) return false;
    }
    return true;
  }

  /** Live position of a plank's body. Physics moves planks, layout does not. */
  pose(id: number): Pose | null {
    const body = this.body(id);
    if (!body) return null;
    const t = body.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  /** Every surviving plank with its live position. */
  livePoses(): Map<number, Pose> {
    const out = new Map<number, Pose>();
    for (const p of this.planks) {
      if (p.removed) continue;
      const pose = this.pose(p.id);
      if (pose) out.set(p.id, pose);
    }
    return out;
  }

  /**
   * Tries a removal without committing to it: snapshot every body, lift the candidate
   * out of the tower, step the solver, measure how much moved, then restore.
   */
  probe(plankId: number, ticks = 45): { fallen: number; maxDisp: number; poses: Map<number, Pose> } {
    const snap = capture(this.bodies);
    const before = this.fallen().length;

    const body = this.body(plankId);
    const collider = body?.collider(0);
    const wasSensor = collider?.isSensor() ?? false;

    if (body && collider) {
      const t = body.translation();
      collider.setSensor(true);
      body.setTranslation({ x: t.x, y: t.y + 30, z: t.z }, true);
      body.wakeUp();
    }

    for (let i = 0; i < ticks; i++) this.world.step();

    const fallen = this.fallen().length - before;
    let maxDisp = 0;
    for (const [id, b] of this.bodies) {
      const s = snap.get(id);
      if (!s || id === plankId) continue;
      const t = b.translation();
      maxDisp = Math.max(maxDisp, Math.hypot(t.x - s.x, t.y - s.y, t.z - s.z));
    }

    // Capture the resulting tower before undoing the probe: the opponent judges the
    // position it is moving into, not just how much it jiggled.
    const poses = new Map<number, Pose>();
    for (const [id, b] of this.bodies) {
      if (id === plankId) continue;
      const t = b.translation();
      poses.set(id, { x: t.x, y: t.y, z: t.z });
    }

    restore(this.bodies, snap);
    if (body && collider) {
      collider.setSensor(wasSensor);
      body.wakeUp();
    }

    return { fallen, maxDisp: Number(maxDisp.toFixed(3)), poses };
  }
  /**
   * Planks that have left the tower.
   *
   * The old check was "below the table", which missed the common case: a plank that
   * slides off the top and lands ON the table, at y around 0.3. A plank now counts as
   * fallen when it sits more than one layer below where its layer belongs.
   */
  fallen(): number[] {
    const out: number[] = [];
    for (const p of this.planks) {
      if (p.removed) continue;
      const body = this.body(p.id);
      if (!body) continue;
      const nominal = PLANK.h / 2 + p.layer * PLANK.h;
      if (body.translation().y < nominal - 0.75) out.push(p.id);
    }
    return out;
  }

  /** Largest distance any surviving plank has moved from where it started. */
  maxDisplacement(): number {
    let worst = 0;
    for (const p of this.planks) {
      if (p.removed) continue;
      const body = this.body(p.id);
      const s = this.start.get(p.id);
      if (!body || !s) continue;
      const t = body.translation();
      worst = Math.max(worst, Math.hypot(t.x - s.x, t.y - s.y, t.z - s.z));
    }
    return worst;
  }

  /** The planks that moved furthest from their start, worst first. */
  displacementReport(limit = 4): { id: number; layer: number; d: number }[] {
    const rows: { id: number; layer: number; d: number }[] = [];
    for (const p of this.planks) {
      if (p.removed) continue;
      const body = this.body(p.id);
      const s = this.start.get(p.id);
      if (!body || !s) continue;
      const t = body.translation();
      rows.push({ id: p.id, layer: p.layer, d: Math.hypot(t.x - s.x, t.y - s.y, t.z - s.z) });
    }
    return rows.sort((a, b) => b.d - a.d).slice(0, limit);
  }

  /** Per-plank transforms for the renderer. */
  transforms(): { id: number; x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number; alongX: boolean }[] {
    const out = [];
    for (const p of this.planks) {
      if (p.removed) continue;
      const body = this.body(p.id);
      if (!body) continue;
      const t = body.translation();
      const r = body.rotation();
      out.push({ id: p.id, x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w, alongX: p.alongX });
    }
    return out;
  }
}

export { PLANK, GAP, LAYERS } from "./tower";
