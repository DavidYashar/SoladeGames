"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { makeWoodTextures } from "@/lib/jenga/wood";

/**
 * Neon Pinball.
 *
 * Real scale: playfield 0.54 m by 1.08 m, bed 0.85 m off the floor. The table is
 * rendered flat, so the slope a real table has is applied as a constant downhill pull
 * toward the player instead of a tilted floor.
 *
 * The plunger corridor runs the full right-hand side. Hold Space to draw the spring,
 * release to fire; the harder you pull, the faster the ball leaves.
 */

const PLAY = { w: 0.54, l: 1.08, y: 0.85 };
const HALF_W = PLAY.w / 2;
const HALF_L = PLAY.l / 2;

// Lane width is two thirds of what it was: 55 mm, about two ball widths.
const LANE_W = 0.055;
const CORRIDOR_Z = -HALF_W + 0.012 + LANE_W / 2;
const DIVIDER_Z = -HALF_W + 0.012 + LANE_W - 0.008;

/**
 * The playfield is not centred on the cabinet: the lane eats the right-hand strip, so
 * everything is mirrored about the lane's inner face instead. That is what keeps the
 * layout symmetric for the player.
 */
const CENTER_Z = (HALF_W - 0.012 + DIVIDER_Z + 0.008) / 2;
const M = (dz: number) => CENTER_Z + dz;
const DIVIDER_FROM = HALF_L - 0.1;
const DIVIDER_TO = -0.22;

/** The corridor exit, drawn and collided from the same points. */
const CIRCUIT: [number, number][] = Array.from(
  { length: 9 },
  (_, i): [number, number] => {
    // Quarter turn from the lane's outer wall round into the playfield.
    const a = Math.PI * 1.5 - (i / 8) * (Math.PI / 2);
    return [-0.22 + 0.218 * Math.cos(a), -0.04 + 0.218 * Math.sin(a)];
  },
);

const RAIL = 0.05;
const RAIL_H = 0.055;

const SLATE = "#1d222a";
const NEON = "#22e0ff";
const NEON_VIOLET = "#a06bff";
const AMBER = "#ffd166";

const BALL_R = 0.0135;
const PLUNGER_X = HALF_L - 0.115;

/** Flipper geometry in radians. Each bat sweeps exactly 30 degrees and comes back. */
const FLIP_REST = 0.785;
const FLIP_SWING = 0.524;
const DOWNHILL = 1.5;

const FLIPPER = { len: 0.1, thick: 0.014, width: 0.028 };

const shared = {
  ball: null as RAPIER.RigidBody | null,
  charge: 0,
  plungerHeld: false,
  score: 0,
  onScore: null as ((v: number) => void) | null,
};

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ table pieces

function Slate() {
  const lines = useMemo(() => {
    const out: number[] = [];
    for (let z = -HALF_W + 0.07; z < HALF_W; z += 0.07) out.push(z);
    return out;
  }, []);

  return (
    <group>
      <mesh position={[0, PLAY.y, 0]} receiveShadow>
        <boxGeometry args={[PLAY.l, 0.016, PLAY.w]} />
        <meshStandardMaterial color={SLATE} roughness={0.42} metalness={0.25} />
      </mesh>

      {lines.map((z) => (
        <mesh key={z} position={[0, PLAY.y + 0.0085, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PLAY.l - 0.04, 0.0012]} />
          <meshBasicMaterial color="#2a2f37" transparent opacity={0.45} toneMapped={false} />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, PLAY.y + 0.009, side * (HALF_W - 0.012)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[PLAY.l - 0.12, 0.004]} />
          <meshBasicMaterial color={side > 0 ? NEON : NEON_VIOLET} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Pop bumper: drum, neon cap, and a skirt in the colour of the reference objects. */
function Bumper({ x, z, color = NEON }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, PLAY.y, z]}>
      <mesh position={[0, 0.016, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.028, 0.032, 0.032, 28]} />
        <meshStandardMaterial color="#20242b" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.035, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.028, 0.008, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.041, 0]}>
        <sphereGeometry args={[0.017, 18, 14]} />
        <meshStandardMaterial color="#0c0e12" roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Slingshot: a triangular bank with a live rubber face, as in the objects sheet. */
function Slingshot({ side }: { side: 1 | -1 }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.11, 0.012);
    s.lineTo(0.02, 0.05);
    s.closePath();
    return s;
  }, []);

  return (
    <group position={[0.14, PLAY.y + 0.022, side * 0.15]} rotation={[Math.PI / 2, 0, side * -0.5]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: 0.022, bevelEnabled: false }]} />
        <meshStandardMaterial color="#23272e" roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={[0.03, 0.004, 0.023]}>
        <boxGeometry args={[0.07, 0.008, 0.006]} />
        <meshStandardMaterial
          color={NEON_VIOLET}
          emissive={NEON_VIOLET}
          emissiveIntensity={1.8}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/**
 * Flipper: the long tapered bat from the sample, with a dark rubber band around the
 * edge and a machined hub. Built along +x so a single rotation aims it.
 */
function FlipperMesh({ side }: { side: 1 | -1 }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0.012, -FLIPPER.width / 2);
    s.lineTo(FLIPPER.len, -0.009);
    s.quadraticCurveTo(FLIPPER.len + 0.012, 0, FLIPPER.len, 0.009);
    s.lineTo(0.012, FLIPPER.width / 2);
    s.quadraticCurveTo(-0.004, 0, 0.012, -FLIPPER.width / 2);
    return s;
  }, []);

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: FLIPPER.thick,
              bevelEnabled: true,
              bevelSize: 0.002,
              bevelThickness: 0.002,
              bevelSegments: 2,
            },
          ]}
        />
        <meshStandardMaterial color="#1b1e23" roughness={0.45} metalness={0.3} />
      </mesh>
      {/* Polished top face */}
      <mesh position={[0, 0, -0.0015]}>
        <extrudeGeometry args={[shape, { depth: 0.002, bevelEnabled: false }]} />
        <meshStandardMaterial color="#e8ebef" roughness={0.22} metalness={0.85} />
      </mesh>
      {/* Hub */}
      <mesh position={[0, 0, -FLIPPER.thick / 2]} castShadow>
        <cylinderGeometry args={[0.017, 0.017, FLIPPER.thick + 0.008, 20]} />
        <meshStandardMaterial color="#9aa1a9" roughness={0.25} metalness={0.95} />
      </mesh>
      <mesh position={[FLIPPER.len - 0.03, 0, -0.0035]}>
        <boxGeometry args={[0.008, 0.004, 0.001]} />
        <meshBasicMaterial color={side > 0 ? NEON : NEON_VIOLET} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The plunger: a spring and shooter rod at the bottom of the lane. */
function PlungerSpring() {
  const spring = useRef<THREE.Group>(null);

  useFrame(() => {
    // Draw the spring back as the player charges, so the pull is visible.
    if (!spring.current) return;
    spring.current.position.x = 0.472 + shared.charge * 0.02;
    spring.current.scale.x = 1 - shared.charge * 0.32;
  });

  return (
    <group ref={spring} position={[0.472, PLAY.y + 0.014, CORRIDOR_Z]}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh key={i} position={[-0.03 + i * 0.009, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.012, 0.0022, 8, 18]} />
          <meshStandardMaterial color="#b9c0c9" roughness={0.3} metalness={0.95} />
        </mesh>
      ))}
      <mesh position={[0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 12]} />
        <meshStandardMaterial color="#dfe4ea" roughness={0.25} metalness={1} />
      </mesh>
    </group>
  );
}

/** Drop target bank. */
function DropTargets() {
  const spots: [number, number][] = [
    [-0.03, -0.02],
    [-0.03, 0.02],
    [-0.06, -0.05],
    [-0.06, 0.05],
    [0, -0.055],
    [0, 0.055],
  ];
  return (
    <group position={[0, PLAY.y, 0]}>
      {spots.map(([tx, tz]) => (
        <group key={`${tx}${tz}`} position={[tx, 0, M(tz)]}>
          <mesh position={[0, 0.014, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.01, 0.028, 0.022]} />
            <meshStandardMaterial color="#39404a" roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh position={[0.006, 0.027, 0]}>
            <boxGeometry args={[0.002, 0.006, 0.018]} />
            <meshStandardMaterial
              color={AMBER}
              emissive={AMBER}
              emissiveIntensity={1.4}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The rollover ring: a circle of posts, exactly as in the layout sheet. */
function RolloverRing({ z }: { z: number }) {
  const ring = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      out.push([Math.cos(a) * 0.15 - 0.02, Math.sin(a) * 0.11]);
    }
    return out;
  }, []);

  return (
    <group>
      {ring.map(([x, dz]) => (
        <group key={`${x}${dz}`} position={[x, PLAY.y, z + dz]}>
          <mesh position={[0, 0.012, 0]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.024, 12]} />
            <meshStandardMaterial color="#c9ced6" roughness={0.3} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.025, 0]}>
            <sphereGeometry args={[0.005, 10, 8]} />
            <meshStandardMaterial
              color={AMBER}
              emissive={AMBER}
              emissiveIntensity={1.2}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Spinner: a flat plate on a gate, from the objects sheet. */
function Spinner({ x, z }: { x: number; z: number }) {
  const plate = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (plate.current) plate.current.rotation.z += delta * 1.2;
  });

  return (
    <group position={[x, PLAY.y, z]}>
      <mesh position={[0, 0.02, -0.03]} castShadow>
        <boxGeometry args={[0.006, 0.03, 0.006]} />
        <meshStandardMaterial color="#8a9099" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh ref={plate} position={[0, 0.02, -0.03]} castShadow>
        <boxGeometry args={[0.001, 0.04, 0.036]} />
        <meshStandardMaterial color="#2f6f8a" emissive={NEON} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Kicker and post blockers, from the objects sheet. */
function Post({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, PLAY.y, z]}>
      <mesh position={[0, 0.014, 0]} castShadow>
        <cylinderGeometry args={[0.008, 0.01, 0.028, 14]} />
        <meshStandardMaterial color="#7d838c" roughness={0.35} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow>
        <sphereGeometry args={[0.008, 12, 10]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ physics + ball

function Pinball({
  onScore,
  onCharge,
}: {
  onScore: (v: number) => void;
  onCharge: (v: number) => void;
}) {
  const { camera, gl } = useThree();
  const ballMesh = useRef<THREE.Mesh>(null);
  const leftFlip = useRef<THREE.Group>(null);
  const rightFlip = useRef<THREE.Group>(null);
  const leftBody = useRef<RAPIER.RigidBody | null>(null);
  const rightBody = useRef<RAPIER.RigidBody | null>(null);
  const world = useRef<RAPIER.World | null>(null);
  const acc = useRef(0);
  const events = useRef<RAPIER.EventQueue | null>(null);
  const scoring = useRef<Record<number, number>>({});
  const [ready, setReady] = useState(false);
  const cleanups = useRef<(() => void)[]>([]);
  const mode = useRef<"idle" | "play">("idle");
  const flip = useRef({
    left: FLIP_REST,
    right: -FLIP_REST,
    leftTarget: FLIP_REST,
    rightTarget: -FLIP_REST,
  });


  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await RAPIER.init();
      if (cancelled) return;

      // The table is flat on screen; the slope is this constant pull toward the player.
      const w = new RAPIER.World({ x: DOWNHILL, y: -9.81, z: 0 });
      w.timestep = 1 / 240;

      // Playfield floor.
      w.createCollider(
        RAPIER.ColliderDesc.cuboid(HALF_L, 0.008, HALF_W)
          .setTranslation(0, PLAY.y, 0)
          .setFriction(0.08)
          .setRestitution(0.18),
      );

      const box = (
        hx: number,
        hz: number,
        x: number,
        z: number,
        restitution = 0.45,
        score = 0,
      ) => {
        const collider = w.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, 0.03, hz)
            .setTranslation(x, PLAY.y + 0.02, z)
            .setFriction(0.12)
            .setRestitution(restitution),
        );
        if (score) scoring.current[collider.handle] = score;
        return collider;
      };

      // Outer walls.
      box(HALF_L, 0.012, 0, HALF_W, 0.5); // left wall
      box(0.012, HALF_W, HALF_L, 0, 0.5); // near wall, behind the plunger

      // The lane's outer wall stops where the exit curve begins.
      box((HALF_L + 0.22) / 2, 0.012, (HALF_L - 0.22) / 2, -HALF_W, 0.5);

      // The far wall is only behind the field; the lane exits through the curve.
      box(0.012, (HALF_W + 0.04) / 2, -HALF_L, (HALF_W - 0.04) / 2, 0.5);

      // Corridor divider: the ball shoots up the right lane and leaves at the top.
      box((DIVIDER_FROM - DIVIDER_TO) / 2, 0.008, (DIVIDER_FROM + DIVIDER_TO) / 2, DIVIDER_Z, 0.3);

      // The corridor exit: a short arc that carries the ball out of the lane and into
      // the playfield, instead of letting it fall straight back down.
      for (let i = 0; i < CIRCUIT.length - 1; i += 1) {
        const [x0, z0] = CIRCUIT[i];
        const [x1, z1] = CIRCUIT[i + 1];
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        w.createCollider(
          RAPIER.ColliderDesc.cuboid(len / 2, 0.03, 0.008)
            .setTranslation((x0 + x1) / 2, PLAY.y + 0.03, (z0 + z1) / 2)
            .setRotation(quatFromY(Math.atan2(-dz, dx)))
            .setFriction(0.1)
            .setRestitution(0.5),
        );
      }

      // Inlane guides: two angled walls that funnel the ball toward the flippers
      // instead of letting it leak out of the bottom corners.
      const guide = (side: 1 | -1) => {
        const x0 = 0.5;
        const z0 = M(side * 0.2);
        const x1 = 0.3;
        const z1 = M(side * 0.088);
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        w.createCollider(
          RAPIER.ColliderDesc.cuboid(len / 2, 0.03, 0.007)
            .setTranslation((x0 + x1) / 2, PLAY.y + 0.03, (z0 + z1) / 2)
            .setRotation(quatFromY(Math.atan2(-dz, dx)))
            .setFriction(0.1)
            .setRestitution(0.5),
        );
      };
      guide(1);
      guide(-1);

      // Bumpers: three large, as in the layout, plus the top one.
      const bumperAt = (x: number, z: number) => {
        const c = w.createCollider(
          RAPIER.ColliderDesc.cylinder(0.03, 0.03)
            .setTranslation(x, PLAY.y + 0.03, z)
            .setFriction(0.05)
            .setRestitution(1.25),
        );
        scoring.current[c.handle] = 100;
      };
      bumperAt(-0.15, M(-0.08));
      bumperAt(-0.15, M(0.08));
      bumperAt(-0.27, M(0));
      bumperAt(-0.33, M(-0.145));
      bumperAt(-0.33, M(0.145));

      // Slingshots.
      const sling = (side: 1 | -1) => {
        const c = w.createCollider(
          RAPIER.ColliderDesc.cuboid(0.06, 0.03, 0.012)
            .setTranslation(0.16, PLAY.y + 0.03, M(side * 0.13))
            .setRotation(quatFromY(side * -0.5))
            .setFriction(0.05)
            .setRestitution(1.2),
        );
        scoring.current[c.handle] = 25;
      };
      sling(1);
      sling(-1);

      // Drop targets: a diamond of six in the middle of the field.
      for (const [tx, tz] of [
        [-0.03, -0.02],
        [-0.03, 0.02],
        [-0.06, -0.05],
        [-0.06, 0.05],
        [0.0, -0.055],
        [0.0, 0.055],
      ]) {
        const c = box(0.008, 0.014, tx, M(tz), 0.7);
        scoring.current[c.handle] = 50;
      }

      // Posts.
      const ring = (cx: number, cz: number, r: number, count: number) => {
        for (let i = 0; i < count; i += 1) {
          const a = (i / count) * Math.PI * 2;
          const c = w.createCollider(
            RAPIER.ColliderDesc.cylinder(0.02, 0.007)
              .setTranslation(cx + Math.cos(a) * r, PLAY.y + 0.02, cz + Math.sin(a) * r)
              .setRestitution(0.7),
          );
          scoring.current[c.handle] = 10;
        }
      };
      ring(-0.02, M(0), 0.13, 12);
      ring(-0.27, M(0), 0.075, 8);
      // Outlane posts, just outside the flipper tips.
      box(0.008, 0.008, 0.34, M(0.16), 0.6);
      box(0.008, 0.008, 0.34, M(-0.155), 0.6);

      // Saucer behind the top arch: catches the ball and kicks it back out.
      const saucer = w.createCollider(
        RAPIER.ColliderDesc.cylinder(0.02, 0.03)
          .setTranslation(-0.38, PLAY.y + 0.02, M(0))
          .setSensor(true),
      );
      scoring.current[saucer.handle] = 250;

      // Flippers: kinematic, so a rotation drags the ball rather than teleporting it.
      const makeFlipper = (side: 1 | -1) => {
        const body = w.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
            0.34,
            PLAY.y + 0.02,
            M(side * 0.112),
          ),
        );
        w.createCollider(
          RAPIER.ColliderDesc.cuboid(FLIPPER.len / 2, 0.012, FLIPPER.width / 2)
            .setTranslation(FLIPPER.len / 2, 0, 0)
            .setFriction(0.1)
            .setRestitution(0.6),
          body,
        );
        body.setRotation(quatFromY(side * FLIP_REST), true);
        return body;
      };
      leftBody.current = makeFlipper(1);
      rightBody.current = makeFlipper(-1);

      // Ball: starts in the corridor, held until the plunger fires.
      const ball = w.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(PLUNGER_X, PLAY.y + BALL_R + 0.02, CORRIDOR_Z)
          .setLinearDamping(0.04)
          .setAngularDamping(0.4)
          .setCcdEnabled(true),
      );
      const ballCollider = w.createCollider(
        RAPIER.ColliderDesc.ball(BALL_R)
          .setDensity(7)
          .setFriction(0.1)
          .setRestitution(0.45)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        ball,
      );

      if (cancelled) {
        w.free();
        return;
      }

      world.current = w;
      events.current = new RAPIER.EventQueue(true);
      shared.ball = ball;
      const ballColliderRef = ballCollider;
      (window as unknown as { __flip?: () => unknown }).__flip = () => ({
        left: Number(flip.current.left.toFixed(3)),
        right: Number(flip.current.right.toFixed(3)),
      });
      (window as unknown as { __at?: (x: number, y: number, z: number) => unknown }).__at = (
        x: number,
        y: number,
        z: number,
      ) => {
        const hits: { h: number; x: number; y: number; z: number }[] = [];
        w.intersectionsWithPoint({ x, y, z }, (c) => {
          const tr = c.translation();
          hits.push({
            h: c.handle,
            x: Number(tr.x.toFixed(3)),
            y: Number(tr.y.toFixed(3)),
            z: Number(tr.z.toFixed(3)),
          });
        });
        return hits;
      };
      (window as unknown as { __ghost?: (on: boolean) => void }).__ghost = (on: boolean) => {
        ballColliderRef.setSensor(on);
      };
      (window as unknown as { __near?: () => unknown }).__near = () => {
        const bt = ball.translation();
        const out: { h: number; x: number; z: number; shape: string }[] = [];
        w.forEachCollider((c) => {
          const tr = c.translation();
          const d = Math.hypot(tr.x - bt.x, tr.z - bt.z);
          if (d < 0.09) {
            out.push({
              h: c.handle,
              x: Number(tr.x.toFixed(3)),
              z: Number(tr.z.toFixed(3)),
              shape: String(c.shape.type),
            });
          }
        });
        return { ball: { x: Number(bt.x.toFixed(3)), z: Number(bt.z.toFixed(3)) }, near: out };
      };
      (window as unknown as { __kick?: (vx: number, vz: number) => void }).__kick = (
        vx: number,
        vz: number,
      ) => {
        mode.current = "play";
        ball.setLinvel({ x: vx, y: 0, z: vz }, true);
      };
      (window as unknown as { __pin?: () => unknown }).__pin = () => {
        const tr = ball.translation();
        const v = ball.linvel();
        return {
          x: tr.x,
          y: tr.y,
          z: tr.z,
          vx: v.x,
          vz: v.z,
          charge: shared.charge,
          mode: mode.current,
          held: shared.plungerHeld,
        };
      };
      shared.onScore = onScore;
      setReady(true);

      // Keyboard: Space charges the plunger, arrows/A-D work the flippers.
      const down = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          e.preventDefault();
          if (mode.current === "idle") shared.plungerHeld = true;
          return;
        }
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          flip.current.leftTarget = FLIP_REST + FLIP_SWING;
        }
        if (e.code === "ArrowRight" || e.code === "KeyD") {
          flip.current.rightTarget = -FLIP_REST - FLIP_SWING;
        }
      };
      const up = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          e.preventDefault();
          if (mode.current !== "idle" || !shared.plungerHeld) return;
          shared.plungerHeld = false;
          mode.current = "play";
          (window as unknown as { __fires?: number }).__fires =
            ((window as unknown as { __fires?: number }).__fires ?? 0) + 1;
          // Charge 0..1 maps onto 1.6..5.4 m/s.
          const speed = 1.6 + shared.charge * 3.8;
          ball.setLinvel({ x: -speed, y: 0, z: 0 }, true);
          (window as unknown as { __fireVel?: unknown }).__fireVel = ball.linvel();
          shared.charge = 0;
          onCharge(0);
          return;
        }
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          flip.current.leftTarget = FLIP_REST;
        }
        if (e.code === "ArrowRight" || e.code === "KeyD") {
          flip.current.rightTarget = -FLIP_REST;
        }
      };

      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      cleanups.current.push(() => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
      });
    })();

    return () => {
      cancelled = true;
      cleanups.current.forEach((fn) => fn());
      cleanups.current = [];
      world.current?.free();
      world.current = null;
      shared.ball = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const resetBall = useCallback(() => {
    const ball = shared.ball;
    if (!ball) return;
    ball.setTranslation(
      { x: PLUNGER_X, y: PLAY.y + BALL_R + 0.02, z: CORRIDOR_Z },
      true,
    );
    ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    shared.charge = 0;
    onCharge(0);
  }, [onCharge]);

  useFrame((_, delta) => {
    const w = world.current;
    const ball = shared.ball;
    if (!w || !ball) return;

    if (shared.plungerHeld && mode.current === "idle") {
      shared.charge = Math.min(1, shared.charge + delta / 1.1);
      onCharge(shared.charge);
    }

    // Rest the ball against the plunger while the lane is loaded.
    if (mode.current === "idle") {
      ball.setTranslation(
        { x: PLUNGER_X + shared.charge * 0.016, y: PLAY.y + BALL_R + 0.02, z: CORRIDOR_Z },
        true,
      );
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // Sweep each flipper toward its target at a fixed rate, so the bat has a real
    // speed instead of snapping through the ball.
    const swing = 16 * delta;
    const f = flip.current;
    const step = (current: number, target: number) => {
      if (Math.abs(target - current) <= swing) return target;
      return current + Math.sign(target - current) * swing;
    };
    f.left = step(f.left, f.leftTarget);
    f.right = step(f.right, f.rightTarget);
    leftBody.current?.setNextKinematicRotation(quatFromY(f.left), true);
    rightBody.current?.setNextKinematicRotation(quatFromY(f.right), true);

    if (leftFlip.current) leftFlip.current.rotation.y = f.left;
    if (rightFlip.current) rightFlip.current.rotation.y = f.right;

    acc.current += Math.min(delta, 0.05);
    let steps = 0;
    while (acc.current >= w.timestep && steps < 12) {
      w.step(events.current ?? undefined);
      acc.current -= w.timestep;
      steps += 1;
    }

    const queue = events.current;
    if (queue) {
      queue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        const value = scoring.current[h1] ?? scoring.current[h2];
        if (value) {
          shared.score += value;
          shared.onScore?.(shared.score);
        }
      });
    }

    const t = ball.translation();
    const r = ball.rotation();
    if (ballMesh.current) {
      ballMesh.current.position.set(t.x, t.y, t.z);
      ballMesh.current.quaternion.set(r.x, r.y, r.z, r.w);
    }

    // Inside the exit curve the wall is bending, so the ball follows it round. The
    // segmented collider reflects a fast ball instead of carrying it; this is the
    // centripetal part of the same interaction, applied where the curve is.
    if (mode.current === "play") {
      const here = ball.translation();
      if (here.x < -0.2 && here.z < -0.12) {
        const dx = -0.22 - here.x;
        const dz = -0.04 - here.z;
        const len = Math.hypot(dx, dz) || 1;
        const v = ball.linvel();
        const pull = 11 * delta;
        ball.setLinvel(
          { x: v.x + (dx / len) * pull, y: v.y, z: v.z + (dz / len) * pull },
          true,
        );
      }
    }

    // The ball has rolled back down the lane onto the plunger: re-arm it so the
    // spring can be pulled again.
    if (
      mode.current === "play" &&
      t.z < DIVIDER_Z &&
      t.x > PLUNGER_X - 0.03 &&
      Math.hypot(ball.linvel().x, ball.linvel().z) < 0.35
    ) {
      mode.current = "idle";
      shared.charge = 0;
      onCharge(0);
      resetBall();
    }

    // Drained: past the flippers into the field, or under the playfield.
    if (mode.current === "play") {
      if (t.y < PLAY.y - 0.08 || (t.x > 0.45 && t.z > DIVIDER_Z + 0.012)) {
        mode.current = "idle";
        shared.charge = 0;
        onCharge(0);
        resetBall();
      }
    }
  });

  return (
    <>
      <mesh ref={ballMesh} position={[0, PLAY.y + BALL_R, 0]} castShadow>
        <sphereGeometry args={[BALL_R, 64, 48]} />
        <meshStandardMaterial color="#d8dde4" roughness={0.12} metalness={0.95} />
      </mesh>

      <group ref={leftFlip} position={[0.34, PLAY.y + 0.02, M(0.112)]}>
        <FlipperMesh side={1} />
      </group>
      <group ref={rightFlip} position={[0.34, PLAY.y + 0.02, M(-0.112)]}>
        <FlipperMesh side={-1} />
      </group>
    </>
  );
}

function quatFromY(angle: number): { x: number; y: number; z: number; w: number } {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

// ------------------------------------------------------------------ cabinet shell

function Cabinet() {
  const textures = useMemo(() => makeWoodTextures(), []);
  const wood = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures.map,
        roughnessMap: textures.roughnessMap,
        color: "#5d4230",
        roughness: 0.55,
        metalness: 0.05,
      }),
    [textures],
  );

  const outerW = PLAY.w + RAIL * 2;
  const outerL = PLAY.l + RAIL * 2;

  return (
    <group>
      <Slate />
      {[
        { pos: [0, PLAY.y - 0.02, outerW / 2 + 0.005], size: [outerL, RAIL_H, RAIL] },
        { pos: [0, PLAY.y - 0.02, -(outerW / 2 + 0.005)], size: [outerL, RAIL_H, RAIL] },
        { pos: [outerL / 2 + 0.005, PLAY.y - 0.02, 0], size: [RAIL, RAIL_H, outerW] },
        { pos: [-(outerL / 2 + 0.005), PLAY.y - 0.02, 0], size: [RAIL, RAIL_H, outerW] },
      ].map((r, i) => (
        <RoundedBox
          key={i}
          args={r.size as [number, number, number]}
          radius={0.008}
          smoothness={2}
          position={r.pos as [number, number, number]}
          castShadow
          receiveShadow
        >
          <primitive object={wood} attach="material" />
        </RoundedBox>
      ))}

      {/* Inner walls, drawn to match the colliders. */}
      {[
        { pos: [0, PLAY.y + 0.02, HALF_W + 0.006], size: [PLAY.l, 0.04, 0.012] },
        { pos: [0, PLAY.y + 0.02, -(HALF_W + 0.006)], size: [PLAY.l, 0.04, 0.012] },
        { pos: [HALF_L + 0.006, PLAY.y + 0.02, 0], size: [0.012, 0.04, PLAY.w] },
        { pos: [-(HALF_L + 0.006), PLAY.y + 0.02, 0], size: [0.012, 0.04, PLAY.w] },
        {
          pos: [(DIVIDER_FROM + DIVIDER_TO) / 2, PLAY.y + 0.02, DIVIDER_Z],
          size: [DIVIDER_FROM - DIVIDER_TO, 0.04, 0.012],
        },
      ].map((r, i) => (
        <mesh key={`w${i}`} position={r.pos as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={r.size as [number, number, number]} />
          <meshStandardMaterial color="#33383f" roughness={0.3} metalness={0.75} />
        </mesh>
      ))}

      <Bumper x={-0.15} z={M(-0.08)} />
      <Bumper x={-0.15} z={M(0.08)} />
      <Bumper x={-0.27} z={M(0)} color={NEON_VIOLET} />
      <Bumper x={-0.33} z={M(-0.145)} color={AMBER} />
      <Bumper x={-0.33} z={M(0.145)} color={AMBER} />

      <DropTargets />
      <RolloverRing z={M(0)} />
      <Spinner x={-0.1} z={M(0.185)} />
      <Spinner x={-0.1} z={M(-0.185)} />

      <Slingshot side={1} />
      <Slingshot side={-1} />

      <PlungerSpring />
      <Post x={0.34} z={M(0.16)} />
      <Post x={0.34} z={M(-0.155)} />
      <Post x={0.44} z={M(0.2)} />
      <Post x={0.44} z={M(-0.2)} />

      {/* Inlane guides, matching their colliders. */}
      {[-1, 1].map((side) => {
        const x0 = 0.5;
        const z0 = M(side * 0.2);
        const x1 = 0.3;
        const z1 = M(side * 0.088);
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        return (
          <mesh
            key={`guide${side}`}
            position={[(x0 + x1) / 2, PLAY.y + 0.02, (z0 + z1) / 2]}
            rotation={[0, Math.atan2(-dz, dx), 0]}
            castShadow
          >
            <boxGeometry args={[len, 0.04, 0.01]} />
            <meshStandardMaterial color="#33383f" roughness={0.3} metalness={0.75} />
          </mesh>
        );
      })}

      {/* Top arch with a saucer behind it. */}
      <mesh position={[-0.33, PLAY.y + 0.02, M(0)]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.009, 10, 28, Math.PI]} />
        <meshStandardMaterial color="#33383f" roughness={0.3} metalness={0.75} />
      </mesh>
      <mesh position={[-0.38, PLAY.y + 0.012, M(0)]}>
        <cylinderGeometry args={[0.03, 0.03, 0.012, 24]} />
        <meshStandardMaterial color="#0a0c10" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[-0.38, PLAY.y + 0.019, M(0)]}>
        <ringGeometry args={[0.026, 0.032, 24]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {CIRCUIT.slice(0, -1).map(([x0, z0], i) => {
        const [x1, z1] = CIRCUIT[i + 1];
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        return (
          <mesh
            key={`circ${i}`}
            position={[(x0 + x1) / 2, PLAY.y + 0.02, (z0 + z1) / 2]}
            rotation={[0, Math.atan2(-dz, dx), 0]}
            castShadow
          >
            <boxGeometry args={[len, 0.04, 0.012]} />
            <meshStandardMaterial color="#33383f" roughness={0.3} metalness={0.75} />
          </mesh>
        );
      })}

      {/* Apron and legs */}
      <mesh position={[0.62, PLAY.y - 0.07, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.1, outerW + 0.02]} />
        <meshStandardMaterial color="#1a120c" roughness={0.7} />
      </mesh>

      {[
        [-outerL / 2 + 0.09, -outerW / 2 + 0.09],
        [-outerL / 2 + 0.09, outerW / 2 - 0.09],
        [outerL / 2 - 0.09, -outerW / 2 + 0.09],
        [outerL / 2 - 0.09, outerW / 2 - 0.09],
      ].map(([lx, lz], i) => (
        <mesh key={`leg${i}`} position={[lx, (PLAY.y - 0.16) / 2, lz]} castShadow receiveShadow>
          <boxGeometry args={[0.07, PLAY.y - 0.16, 0.07]} />
          <primitive object={wood} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

export function PinballTable() {
  const [score, setScore] = useState(0);
  const [charge, setCharge] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    const v = Number(window.localStorage.getItem("imarket:pinball:best") || 0);
    if (v > 0) setBest(v);
  }, []);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      window.localStorage.setItem("imarket:pinball:best", String(score));
    }
  }, [score, best]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#050506]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [1.18, 2.26, 0], fov: 40, near: 0.02, far: 40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ camera }) => camera.lookAt(0, PLAY.y + 0.02, 0)}
      >
        <color attach="background" args={["#050506"]} />
        <fog attach="fog" args={["#050506", 3.5, 14]} />

        <ambientLight intensity={0.28} />
        <spotLight
          position={[0.35, 2.2, 0.1]}
          angle={0.7}
          penumbra={0.8}
          intensity={18}
          distance={4}
          decay={2}
          color="#fff2dc"
          castShadow={false}
          target-position={[0, PLAY.y, 0]}
        />
        <directionalLight position={[1.2, 2.4, 1.2]} intensity={0.8} color="#ffe9c8" castShadow />

        <Cabinet />
        <Pinball onScore={setScore} onCharge={setCharge} />

        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[16, 16]} />
          <meshStandardMaterial color="#060606" roughness={1} metalness={0} />
        </mesh>
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500">Score</p>
            <p className="font-display text-2xl tabular-nums text-zinc-100">{score}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500">Best</p>
            <p className="font-display text-2xl tabular-nums text-zinc-100">{best}</p>
          </div>
        </div>

        <div className="mx-auto mb-24 w-40">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-300 transition-[width] duration-75"
              style={{ width: `${Math.round(charge * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-center font-display text-[9px] uppercase tracking-[0.16em] text-zinc-400">
            hold space · release to launch
          </p>
        </div>
      </div>
    </div>
  );
}
