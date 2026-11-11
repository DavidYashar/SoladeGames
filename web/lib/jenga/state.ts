/**
 * Snapshot and probe support.
 *
 * The opponent must judge the tower as it actually stands, so the model needs two
 * things the layout data cannot give it: live body positions, and a way to try a move
 * without committing to it. A probe snapshots every body, performs the removal, steps
 * the solver, measures, then restores the snapshot exactly. Nothing the probe does
 * survives it.
 *
 * This file is imported by the simulation class below; it is separated only so the
 * state capture stays readable.
 */

import type RAPIER from "@dimforge/rapier3d-compat";

export interface BodySnapshot {
  id: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  vx: number;
  vy: number;
  vz: number;
  wx: number;
  wy: number;
  wz: number;
}

export interface Pose {
  x: number;
  y: number;
  z: number;
}

export function capture(
  bodies: Map<number, RAPIER.RigidBody>,
): Map<number, BodySnapshot> {
  const out = new Map<number, BodySnapshot>();
  for (const [id, body] of bodies) {
    const t = body.translation();
    const r = body.rotation();
    const v = body.linvel();
    const w = body.angvel();
    out.set(id, {
      id,
      x: t.x,
      y: t.y,
      z: t.z,
      qx: r.x,
      qy: r.y,
      qz: r.z,
      qw: r.w,
      vx: v.x,
      vy: v.y,
      vz: v.z,
      wx: w.x,
      wy: w.y,
      wz: w.z,
    });
  }
  return out;
}

export function restore(
  bodies: Map<number, RAPIER.RigidBody>,
  snap: Map<number, BodySnapshot>,
): void {
  for (const [id, body] of bodies) {
    const s = snap.get(id);
    if (!s) continue;
    body.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
    body.setRotation({ x: s.qx, y: s.qy, z: s.qz, w: s.qw }, true);
    body.setLinvel({ x: s.vx, y: s.vy, z: s.vz }, true);
    body.setAngvel({ x: s.wx, y: s.wy, z: s.wz }, true);
    body.wakeUp();
  }
}
