"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { brickAudio } from "@/lib/brick-blitz/audio";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { Mesh } from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { makeBallTexture, makeShadowTexture } from "@/lib/jenga/ball-skin";
import { makeBrickTextures } from "@/lib/jenga/brick-skins";
import { makeWoodTextures } from "@/lib/jenga/wood";

/**
 * Brick Blitz on a billiard table.
 *
 * The ball is a rigid body; the wall is a grid of bricks that crack, then burst, and a
 * fresh row arrives every ten seconds and pushes the wall toward the player. Clearing
 * the wall wins. Letting it cross the halfway line loses.
 */

const BED = { w: 2.24, d: 1.58, y: 0.78 };
const RAIL = 0.1;
const RAIL_H = 0.085;
const CUSHION = 0.045;

const FELT = "#1f6b45";
const FELT_DARK = "#175236";
const CLOTH_ROUGHNESS = 0.95;

const BRICK = { w: 0.16, h: 0.075, d: 0.075 };
const BRICK_COLS = 8;
const ROW_STEP = BRICK.d + 0.02;
const SPAWN_X = -0.98;
const MIDLINE_X = 0;
const START_ROWS = 5;
const ROW_SECONDS = 10;

type BrickKind = "clay" | "stone" | "keg" | "gold" | "glass" | "iron";

const BRICK_WEIGHTS: { kind: BrickKind; weight: number }[] = [
  { kind: "clay", weight: 52 },
  { kind: "stone", weight: 20 },
  { kind: "glass", weight: 10 },
  { kind: "keg", weight: 8 },
  { kind: "gold", weight: 6 },
  { kind: "iron", weight: 4 },
];

const BRICK_HP: Record<BrickKind, number> = {
  clay: 1,
  glass: 1,
  keg: 1,
  gold: 1,
  stone: 2,
  iron: 3,
};

const BRICK_POINTS: Record<BrickKind, number> = {
  clay: 10,
  glass: 15,
  stone: 25,
  keg: 40,
  gold: 50,
  iron: 60,
};

interface BrickLook {
  roughness: number;
  metalness: number;
  bumpScale: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  envMapIntensity?: number;
}

const BRICK_LOOK: Record<BrickKind, BrickLook> = {
  clay: { roughness: 0.92, metalness: 0.02, bumpScale: 0.025 },
  stone: { roughness: 0.96, metalness: 0.03, bumpScale: 0.03 },
  keg: { roughness: 0.72, metalness: 0.35, bumpScale: 0.02 },
  gold: { roughness: 0.2, metalness: 1, bumpScale: 0.006, envMapIntensity: 1.4 },
  glass: {
    roughness: 0.06,
    metalness: 0,
    bumpScale: 0.012,
    opacity: 0.62,
    emissive: "#0d3540",
    emissiveIntensity: 0.35,
    envMapIntensity: 1.2,
  },
  iron: { roughness: 0.42, metalness: 0.95, bumpScale: 0.012, envMapIntensity: 1.1 },
};

/** How each material comes apart. Colour, count, speed and life of its burst. */
const BURST: Record<
  BrickKind,
  { colors: string[]; count: number; speed: number; size: number; life: number; gravity: number }
> = {
  clay: {
    colors: ["#b0533a", "#8a3a2c", "#6d3524", "#c06343"],
    count: 14,
    speed: 1.5,
    size: 0.016,
    life: 0.62,
    gravity: 3.4,
  },
  stone: {
    colors: ["#7c7e82", "#5f6266", "#9a9da1"],
    count: 12,
    speed: 1.3,
    size: 0.018,
    life: 0.7,
    gravity: 4,
  },
  glass: {
    colors: ["#c9f2fb", "#8fdff0", "#63c6e0", "#ffffff"],
    count: 20,
    speed: 2.6,
    size: 0.011,
    life: 0.72,
    gravity: 2.2,
  },
  keg: {
    colors: ["#ff8a3d", "#ffd166", "#ff4d2e", "#3a2a22"],
    count: 18,
    speed: 2.2,
    size: 0.016,
    life: 0.55,
    gravity: 2.8,
  },
  gold: {
    colors: ["#ffe9a8", "#d8a53c", "#fff6d8", "#a97c1f"],
    count: 14,
    speed: 1.9,
    size: 0.013,
    life: 0.6,
    gravity: 3,
  },
  iron: {
    colors: ["#ffffff", "#ffd9a0", "#c8ccd2", "#8a8f96"],
    count: 16,
    speed: 2.4,
    size: 0.012,
    life: 0.8,
    gravity: 4.6,
  },
};

const BOUNCE_BOOST: Record<BrickKind, number> = {
  clay: 1.12,
  stone: 1.15,
  keg: 1.15,
  gold: 1.18,
  glass: 1.24,
  iron: 1.3,
};

const BRICK_BOUNCE: Record<BrickKind, { restitution: number; friction: number }> = {
  clay: { restitution: 0.3, friction: 0.7 },
  stone: { restitution: 0.45, friction: 0.75 },
  glass: { restitution: 0.96, friction: 0.12 },
  keg: { restitution: 0.4, friction: 0.5 },
  gold: { restitution: 0.62, friction: 0.28 },
  iron: { restitution: 0.94, friction: 0.18 },
};

const HANDLER_BOOST = 1.2;
const CUSHION_BOOST = 1.06;

const BALL_R = 0.042;
const FELT_TOP = BED.y + 0.02;
const BALL_SPEED = 3.8;
const MIN_SPEED = 3;
const MAX_SPEED = 7;

const HANDLER_X = 0.86;
const HANDLER_Y = FELT_TOP + 0.032;
const HANDLER_HALF = 0.23;

interface Brick {
  id: number;
  kind: BrickKind;
  row: number;
  col: number;
  hp: number;
}

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

const rowX = (row: number) => SPAWN_X + row * ROW_STEP;
const colZ = (col: number) => -((BRICK_COLS - 1) * (BRICK.w + 0.02)) / 2 + col * (BRICK.w + 0.02);

function weightedKind(random: () => number): BrickKind {
  const total = BRICK_WEIGHTS.reduce((sum, b) => sum + b.weight, 0);
  let r = random() * total;
  for (const b of BRICK_WEIGHTS) {
    r -= b.weight;
    if (r <= 0) return b.kind;
  }
  return "clay";
}

let nextId = 1;

/** A row of bricks at a given row index, with a weighted mix of materials. */
function makeRow(row: number, random: () => number): Brick[] {
  const out: Brick[] = [];
  for (let col = 0; col < BRICK_COLS; col += 1) {
    const kind = weightedKind(random);
    out.push({ id: nextId++, kind, row, col, hp: BRICK_HP[kind] });
  }
  return out;
}

function makeWall(): Brick[] {
  const random = seeded(0x5b21c);
  const out: Brick[] = [];
  for (let row = 0; row < START_ROWS; row += 1) out.push(...makeRow(row, random));
  return out;
}

let brickMaterials: Record<BrickKind, THREE.MeshStandardMaterial> | null = null;

function getBrickMaterials(): Record<BrickKind, THREE.MeshStandardMaterial> {
  if (brickMaterials) return brickMaterials;
  const built = {} as Record<BrickKind, THREE.MeshStandardMaterial>;
  (Object.keys(BRICK_LOOK) as BrickKind[]).forEach((kind) => {
    const look = BRICK_LOOK[kind];
    const textures = makeBrickTextures(kind);
    built[kind] = new THREE.MeshStandardMaterial({
      map: textures.map,
      roughnessMap: textures.roughnessMap,
      bumpMap: textures.bumpMap,
      bumpScale: look.bumpScale,
      roughness: look.roughness,
      metalness: look.metalness,
      transparent: look.opacity !== undefined,
      opacity: look.opacity ?? 1,
      emissive: look.emissive ?? "#000000",
      emissiveIntensity: look.emissiveIntensity ?? 0,
      envMapIntensity: look.envMapIntensity ?? 0.7,
    });
  });
  brickMaterials = built;
  return built;
}

const shared = {
  handlerZ: 0,
  handlerBody: null as RAPIER.RigidBody | null,
  ballBody: null as RAPIER.RigidBody | null,
};

// ------------------------------------------------------------------ small pieces

function KegBands() {
  return (
    <>
      {[-0.045, 0.045].map((z) => (
        <mesh key={z} position={[BRICK.d / 2 - 0.001, 0, z]}>
          <boxGeometry args={[0.004, BRICK.h * 0.98, 0.014]} />
          <meshStandardMaterial color="#241713" roughness={0.55} metalness={0.55} />
        </mesh>
      ))}
    </>
  );
}

function Rivets() {
  return (
    <>
      {[
        [-0.045, -0.026],
        [0.045, -0.026],
        [-0.045, 0.026],
        [0.045, 0.026],
      ].map(([z, y]) => (
        <mesh key={`${z}${y}`} position={[BRICK.d / 2 - 0.001, y, z]}>
          <sphereGeometry args={[0.005, 10, 8]} />
          <meshStandardMaterial color="#9aa1a9" roughness={0.3} metalness={0.95} />
        </mesh>
      ))}
    </>
  );
}

/** Cracks appear as a brick takes damage. */
function Cracks({ level }: { level: number }) {
  const lines = [
    { y: 0.012, z: -0.03, len: 0.05, rot: 0.5 },
    { y: -0.014, z: 0.02, len: 0.045, rot: -0.7 },
    { y: 0.002, z: 0.05, len: 0.03, rot: 0.2 },
  ].slice(0, Math.min(level, 3));

  return (
    <>
      {lines.map((line, i) => (
        <mesh
          key={i}
          position={[BRICK.d / 2 + 0.001, line.y, line.z]}
          rotation={[0, 0, line.rot]}
        >
          <boxGeometry args={[0.002, 0.0025, line.len]} />
          <meshStandardMaterial color="#1b1310" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

function BrickMesh({ brick }: { brick: Brick }) {
  const materials = useMemo(() => getBrickMaterials(), []);
  const maxHp = BRICK_HP[brick.kind];
  const damage = maxHp - brick.hp;

  return (
    <RoundedBox
      args={[BRICK.d, BRICK.h, BRICK.w]}
      radius={0.008}
      smoothness={2}
      position={[rowX(brick.row), BED.y + BRICK.h / 2, colZ(brick.col)]}
      castShadow
      receiveShadow
    >
      <primitive object={materials[brick.kind]} attach="material" />
      {brick.kind === "keg" ? <KegBands /> : null}
      {brick.kind === "iron" ? <Rivets /> : null}
      {damage > 0 ? <Cracks level={damage} /> : null}
    </RoundedBox>
  );
}

/** A material-specific burst. Purely visual: it never damages neighbours. */
function Burst({ kind, x, z }: { kind: BrickKind; x: number; z: number }) {
  const style = BURST[kind];
  const meshes = useRef<THREE.Mesh[]>([]);
  const elapsed = useRef(0);

  const parts = useMemo(() => {
    const random = seeded(Math.round((x + 5) * 1000) + Math.round((z + 5) * 977));
    return Array.from({ length: style.count }, () => ({
      dir: new THREE.Vector3(random() - 0.5, random() * 0.9 + 0.25, random() - 0.5).normalize(),
      speed: style.speed * (0.55 + random() * 0.9),
      size: style.size * (0.5 + random() * 0.9),
      color: style.colors[Math.floor(random() * style.colors.length)],
      spin: (random() - 0.5) * 14,
    }));
  }, [style, x, z]);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;
    parts.forEach((part, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const damp = 1 - Math.min(1, t / style.life);
      mesh.position.set(
        x + part.dir.x * part.speed * t,
        BED.y + BRICK.h / 2 + part.dir.y * part.speed * t - style.gravity * t * t * 0.5,
        z + part.dir.z * part.speed * t,
      );
      mesh.rotation.x += part.spin * 0.02;
      mesh.rotation.z += part.spin * 0.015;
      mesh.scale.setScalar(Math.max(0.01, damp));
      (mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(1, damp * 1.6);
    });
  });

  return (
    <group>
      {parts.map((part, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) meshes.current[i] = m;
          }}
          position={[x, BED.y + BRICK.h / 2, z]}
        >
          <boxGeometry args={[part.size, part.size, part.size]} />
          <meshStandardMaterial
            color={part.color}
            emissive={part.color}
            emissiveIntensity={kind === "keg" || kind === "iron" ? 1.2 : 0.35}
            roughness={0.5}
            metalness={kind === "gold" || kind === "iron" ? 0.9 : 0.1}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function Midline() {
  return (
    <group>
      <mesh position={[MIDLINE_X, FELT_TOP + 0.0015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.012, BED.d]} />
        <meshBasicMaterial color="#e8e2d0" transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A neutral room probe, so metal bricks have something to reflect. */
function EnvSetup() {
  const { gl, scene } = useThree();

  useEffect(() => {
    let disposed: THREE.Texture | null = null;
    void (async () => {
      const { RoomEnvironment } = await import(
        "three/examples/jsm/environments/RoomEnvironment.js"
      );
      const pmrem = new THREE.PMREMGenerator(gl);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.2;
      disposed = env;
      pmrem.dispose();
    })();
    return () => {
      scene.environment = null;
      disposed?.dispose();
    };
  }, [gl, scene]);

  return null;
}

/** The handler: the gilt bar the player moves near their end of the table. */
function Handler() {
  const { camera, gl } = useThree();
  const group = useRef<THREE.Group>(null);
  const gold = useMemo(() => getBrickMaterials().gold, []);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -FELT_TOP), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const aim = (event: PointerEvent): boolean => {
    const rect = gl.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(plane, hit) !== null;
  };

  useEffect(() => {
    const element = gl.domElement;

    const onMove = (event: PointerEvent) => {
      if (!aim(event)) return;
      const limit = BED.d / 2 - HANDLER_HALF - 0.02;
      shared.handlerZ = THREE.MathUtils.clamp(hit.z, -limit, limit);
    };

    const onDown = (event: PointerEvent) => {
      void brickAudio.unlock();
      if (!aim(event)) return;
      const ball = shared.ballBody;
      if (!ball) return;

      const spawnX = HANDLER_X - 0.14;
      const spawnZ = shared.handlerZ;
      ball.setTranslation({ x: spawnX, y: FELT_TOP + BALL_R, z: spawnZ }, true);
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true);

      const lean = THREE.MathUtils.clamp((hit.z / (BED.d / 2)) * 1.05, -0.92, 0.92);
      const scale = 1 / Math.hypot(1, lean);
      brickAudio.serve();
      ball.setLinvel(
        { x: -scale * BALL_SPEED, y: 0, z: lean * scale * BALL_SPEED },
        true,
      );
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerdown", onDown);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerdown", onDown);
    };
  }, [camera, gl, raycaster, plane, pointer, hit]);

  useFrame(() => {
    if (group.current) group.current.position.z = shared.handlerZ;
  });

  return (
    <group ref={group} position={[HANDLER_X, HANDLER_Y, 0]}>
      <RoundedBox
        args={[0.07, 0.055, HANDLER_HALF * 2]}
        radius={0.014}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <primitive object={gold} attach="material" />
      </RoundedBox>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.074, 0.008, HANDLER_HALF * 2 + 0.002]} />
        <meshStandardMaterial
          color="#ffe9ab"
          emissive="#6a4c12"
          emissiveIntensity={0.9}
          metalness={1}
          roughness={0.12}
        />
      </mesh>
    </group>
  );
}

/**
 * Physics: table, ball, handler, and a collider per live brick.
 *
 * Brick colliders are diffed against the rendered wall, so a destroyed brick leaves a
 * real gap and a spawned row gets solid immediately.
 */
function Physics({
  bricks,
  onHit,
  onReady,
  frozen,
}: {
  bricks: Brick[];
  onHit: (id: number) => void;
  onReady: () => void;
  frozen: boolean;
}) {
  const { camera, gl } = useThree();
  const mesh = useRef<Mesh>(null);
  const shadow = useRef<Mesh>(null);
  const world = useRef<RAPIER.World | null>(null);
  const body = useRef<RAPIER.RigidBody | null>(null);
  const lastVelocity = useRef({ x: 0, z: 0 });
  const ballCollider = useRef(0);
  const byHandle = useRef(new Map<number, number>());
  const colliderForBrick = useRef(new Map<number, RAPIER.Collider>());
  const brickForCollider = useRef(new Map<number, number>());
  const boostByHandle = useRef(new Map<number, number>());
  const incoming = useRef(0);
  const acc = useRef(0);
  const events = useRef<RAPIER.EventQueue | null>(null);
  const hitRef = useRef(onHit);
  const frozenRef = useRef(frozen);
  const [ready, setReady] = useState(false);
  const skin = useMemo(() => makeBallTexture(), []);
  const shadowTex = useMemo(() => makeShadowTexture(), []);

  hitRef.current = onHit;
  frozenRef.current = frozen;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await RAPIER.init();
      if (cancelled) return;

      const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      w.timestep = 1 / 120;
      w.integrationParameters.normalizedPredictionDistance = 0.0005;

      w.createCollider(
        RAPIER.ColliderDesc.cuboid(BED.w / 2, 0.02, BED.d / 2)
          .setTranslation(0, BED.y, 0)
          .setFriction(0.35)
          .setRestitution(0.55),
      );

      const wall = (hx: number, hy: number, hz: number, x: number, y: number, z: number) => {
        const collider = w.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz)
            .setTranslation(x, y, z)
            .setFriction(0.2)
            .setRestitution(0.92),
        );
        boostByHandle.current.set(collider.handle, CUSHION_BOOST);
      };

      wall(BED.w / 2, 0.05, 0.02, 0, BED.y + 0.05, BED.d / 2 + 0.02);
      wall(BED.w / 2, 0.05, 0.02, 0, BED.y + 0.05, -(BED.d / 2 + 0.02));
      wall(0.02, 0.05, BED.d / 2, BED.w / 2 + 0.02, BED.y + 0.05, 0);
      wall(0.02, 0.05, BED.d / 2, -(BED.w / 2 + 0.02), BED.y + 0.05, 0);

      const handlerBody = w.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          HANDLER_X,
          HANDLER_Y,
          shared.handlerZ,
        ),
      );
      const handlerCollider = w.createCollider(
        RAPIER.ColliderDesc.cuboid(0.035, 0.055, HANDLER_HALF)
          .setFriction(0.25)
          .setRestitution(0.9),
        handlerBody,
      );
      boostByHandle.current.set(handlerCollider.handle, HANDLER_BOOST);
      shared.handlerBody = handlerBody;

      const ballBody = w.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(0.42, FELT_TOP + BALL_R, 0.3)
          .setLinearDamping(0.06)
          .setAngularDamping(0.15)
          .setCcdEnabled(true),
      );
      const ball = w.createCollider(
        RAPIER.ColliderDesc.ball(BALL_R)
          .setDensity(1.6)
          .setFriction(0.15)
          .setRestitution(0.88)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        ballBody,
      );
      ballCollider.current = ball.handle;

      ballBody.setLinvel({ x: -BALL_SPEED, y: 0, z: -0.4 }, true);

      if (cancelled) {
        w.free();
        return;
      }

      world.current = w;
      body.current = ballBody;
      events.current = new RAPIER.EventQueue(true);
      shared.ballBody = ballBody;
      setReady(true);
      onReady();
    })();

    return () => {
      cancelled = true;
      world.current?.free();
      world.current = null;
      body.current = null;
      setReady(false);
    };
  }, [onReady]);

  // Diff the wall against the physics world.
  useEffect(() => {
    const w = world.current;
    if (!ready || !w) return;

    const alive = new Set(bricks.map((b) => b.id));

    for (const [id, collider] of colliderForColliderEntries()) {
      if (alive.has(id)) continue;
      byHandle.current.delete(collider.handle);
      brickForCollider.current.delete(collider.handle);
      boostByHandle.current.delete(collider.handle);
      w.removeCollider(collider, false);
      colliderForBrick.current.delete(id);
    }

    for (const brick of bricks) {
      const existing = colliderForBrick.current.get(brick.id);
      const x = rowX(brick.row);
      if (existing && Math.abs(existing.translation().x - x) < 1e-6) continue;
      if (existing) {
        byHandle.current.delete(existing.handle);
        brickForCollider.current.delete(existing.handle);
        boostByHandle.current.delete(existing.handle);
        w.removeCollider(existing, false);
        colliderForBrick.current.delete(brick.id);
      }

      const bounce = BRICK_BOUNCE[brick.kind];
      const collider = w.createCollider(
        RAPIER.ColliderDesc.cuboid(BRICK.d / 2, BRICK.h / 2, BRICK.w / 2)
          .setTranslation(x, BED.y + BRICK.h / 2, colZ(brick.col))
          .setFriction(bounce.friction)
          .setRestitution(bounce.restitution),
      );
      colliderForBrick.current.set(brick.id, collider);
      brickForCollider.current.set(collider.handle, brick.id);
      boostByHandle.current.set(collider.handle, BOUNCE_BOOST[brick.kind]);
    }

    function colliderForColliderEntries(): [number, RAPIER.Collider][] {
      return [...colliderForBrick.current.entries()];
    }
  }, [bricks, ready]);

  useFrame((_, delta) => {
    const w = world.current;
    const b = body.current;
    if (!w || !b) return;

    shared.handlerBody?.setNextKinematicTranslation({
      x: HANDLER_X,
      y: HANDLER_Y,
      z: shared.handlerZ,
    });

    if (!frozenRef.current) {
      const approach = b.linvel();
      incoming.current = Math.hypot(approach.x, approach.z);

      acc.current += Math.min(delta, 0.1);
      let steps = 0;
      while (acc.current >= w.timestep && steps < 8) {
        w.step(events.current ?? undefined);
        acc.current -= w.timestep;
        steps += 1;
      }

      const queue = events.current;
      if (queue) {
        const ballHandle = ballCollider.current;
        queue.drainCollisionEvents((h1, h2, started) => {
          if (!started) return;
          if (h1 !== ballHandle && h2 !== ballHandle) return;
          const other = h1 === ballHandle ? h2 : h1;

          const boost = boostByHandle.current.get(other);
          if (boost) {
            const v = b.linvel();
            const speed = Math.hypot(v.x, v.z);
            if (speed > 0.02) {
              const target = Math.min(MAX_SPEED, Math.max(MIN_SPEED, incoming.current * boost));
              const k = target / speed;
              b.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
            }
          }

          const brickId = brickForCollider.current.get(other);
          if (brickId !== undefined) hitRef.current(brickId);
        });
      }

      const v = b.linvel();
      const speed = Math.hypot(v.x, v.z);
      if (speed > 0.05 && speed < MIN_SPEED) {
        const k = MIN_SPEED / speed;
        b.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
      } else if (speed <= 0.05) {
        b.setTranslation(
          { x: HANDLER_X - 0.14, y: FELT_TOP + BALL_R, z: shared.handlerZ },
          true,
        );
        b.setLinvel({ x: -BALL_SPEED, y: 0, z: 0 }, true);
      }
    }

    // Rolling bed, and a thump whenever the ball is knocked off course — that covers
    // the cushions, the brick faces and the handler without tracking collider handles.
    const vel = b.linvel();
    const speedNow = Math.hypot(vel.x, vel.z);
    brickAudio.roll(speedNow);
    {
      const prev = lastVelocity.current;
      const dv = Math.hypot(vel.x - prev.x, vel.z - prev.z);
      lastVelocity.current = { x: vel.x, z: vel.z };
      if (dv > 1.1) brickAudio.cushion(Math.min(1, dv / 6));
    }

    const t = b.translation();
    const r = b.rotation();
    if (mesh.current) {
      mesh.current.position.set(t.x, t.y, t.z);
      mesh.current.quaternion.set(r.x, r.y, r.z, r.w);
    }
    if (shadow.current) {
      const lift = Math.max(0, t.y - (FELT_TOP + BALL_R));
      const spread = 1 + lift * 0.5;
      shadow.current.position.set(t.x + BALL_R * 0.55, FELT_TOP + 0.002, t.z);
      shadow.current.scale.set(spread, 1, spread);
    }
  });

  return (
    <>
      <mesh ref={mesh} position={[0.42, FELT_TOP + BALL_R, 0.3]} castShadow receiveShadow>
        <sphereGeometry args={[BALL_R, 96, 64]} />
        <meshPhysicalMaterial
          map={skin}
          color="#9ec9ff"
          roughness={0.18}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0.42, FELT_TOP + 0.002, 0.3]}>
        <planeGeometry args={[BALL_R * 2.4, BALL_R * 2.4]} />
        <meshBasicMaterial
          map={shadowTex}
          transparent
          opacity={0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

function Table() {
  const { w, d, y } = BED;
  const outerW = w + RAIL * 2;
  const outerD = d + RAIL * 2;

  const textures = useMemo(() => makeWoodTextures(), []);
  const wood = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures.map,
        roughnessMap: textures.roughnessMap,
        color: "#6b4a2f",
        roughness: 0.55,
        metalness: 0.05,
      }),
    [textures],
  );

  return (
    <group>
      <mesh position={[0, y, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color={FELT} roughness={CLOTH_ROUGHNESS} metalness={0} />
      </mesh>

      <mesh position={[0, y - 0.005, 0]} receiveShadow>
        <boxGeometry args={[w + 0.02, 0.045, d + 0.02]} />
        <meshStandardMaterial color={FELT_DARK} roughness={CLOTH_ROUGHNESS} />
      </mesh>

      {[
        { pos: [0, y + RAIL_H / 2, (d + RAIL) / 2], size: [outerW, RAIL_H, RAIL] },
        { pos: [0, y + RAIL_H / 2, -(d + RAIL) / 2], size: [outerW, RAIL_H, RAIL] },
        { pos: [(w + RAIL) / 2, y + RAIL_H / 2, 0], size: [RAIL, RAIL_H, d] },
        { pos: [-(w + RAIL) / 2, y + RAIL_H / 2, 0], size: [RAIL, RAIL_H, d] },
      ].map((r, i) => (
        <RoundedBox
          key={i}
          args={r.size as [number, number, number]}
          radius={0.012}
          smoothness={2}
          position={r.pos as [number, number, number]}
          castShadow
          receiveShadow
        >
          <primitive object={wood} attach="material" />
        </RoundedBox>
      ))}

      {[
        { pos: [0, y + RAIL_H / 2 - 0.01, d / 2 + CUSHION / 2], size: [w + RAIL, 0.05, CUSHION] },
        { pos: [0, y + RAIL_H / 2 - 0.01, -(d / 2 + CUSHION / 2)], size: [w + RAIL, 0.05, CUSHION] },
        { pos: [w / 2 + CUSHION / 2, y + RAIL_H / 2 - 0.01, 0], size: [CUSHION, 0.05, d] },
        { pos: [-(w / 2 + CUSHION / 2), y + RAIL_H / 2 - 0.01, 0], size: [CUSHION, 0.05, d] },
      ].map((r, i) => (
        <mesh key={`c${i}`} position={r.pos as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={r.size as [number, number, number]} />
          <meshStandardMaterial color={FELT} roughness={CLOTH_ROUGHNESS} />
        </mesh>
      ))}

      <mesh position={[0, y - 0.11, 0]} castShadow receiveShadow>
        <boxGeometry args={[outerW + 0.02, 0.16, outerD + 0.02]} />
        <meshStandardMaterial color="#1a120c" roughness={0.7} />
      </mesh>
      {[
        [-outerW / 2 + 0.14, -outerD / 2 + 0.14],
        [outerW / 2 - 0.14, -outerD / 2 + 0.14],
        [-outerW / 2 + 0.14, outerD / 2 - 0.14],
        [outerW / 2 - 0.14, outerD / 2 - 0.14],
      ].map(([lx, lz], i) => (
        <mesh key={`leg${i}`} position={[lx, (y - 0.19) / 2, lz]} castShadow receiveShadow>
          <boxGeometry args={[0.14, y - 0.19, 0.14]} />
          <primitive object={wood} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

interface Boom {
  id: number;
  kind: BrickKind;
  x: number;
  z: number;
  until: number;
}

type Status = "playing" | "won" | "lost";

export function PoolTable() {
  const [bricks, setBricks] = useState<Brick[]>(() => makeWall());
  const bricksRef = useRef(bricks);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [booms, setBooms] = useState<Boom[]>([]);
  const [ready, setReady] = useState(false);
  const [nextRowIn, setNextRowIn] = useState(ROW_SECONDS);
  const deadline = useRef(Date.now() + ROW_SECONDS * 1000);
  const statusRef = useRef(status);
  statusRef.current = status;

  const commit = useCallback((next: Brick[]) => {
    bricksRef.current = next;
    setBricks(next);
  }, []);

  const hit = useCallback(
    (id: number) => {
      if (statusRef.current !== "playing") return;
      const current = bricksRef.current;
      const brick = current.find((b) => b.id === id);
      if (!brick) return;

      if (brick.hp > 1) {
        brickAudio.brick(brick.kind, false);
        commit(current.map((b) => (b.id === id ? { ...b, hp: b.hp - 1 } : b)));
        return;
      }

      brickAudio.brick(brick.kind, true);

      const now = Date.now();
      setBooms((list) => [
        ...list,
        { id: brick.id, kind: brick.kind, x: rowX(brick.row), z: colZ(brick.col), until: now + 1200 },
      ]);
      setScore((s) => s + BRICK_POINTS[brick.kind]);

      const left = current.filter((b) => b.id !== id);
      commit(left);
      if (left.length === 0) {
        brickAudio.win();
        setStatus("won");
      }
    },
    [commit],
  );

  // Advance the wall: a fresh row at the far end, everything else one row closer.
  const spawnRow = useCallback(() => {
    if (statusRef.current !== "playing") return;
    const shifted = bricksRef.current.map((b) => ({ ...b, row: b.row + 1 }));
    const fresh = makeRow(0, Math.random);
    const next = [...shifted, ...fresh];
    brickAudio.rowAdvance();
    commit(next);
    if (next.some((b) => rowX(b.row) >= MIDLINE_X)) {
      brickAudio.lose();
      setStatus("lost");
    }
  }, [commit]);

  useEffect(() => {
    if (status !== "playing" || !ready) return;
    deadline.current = Date.now() + ROW_SECONDS * 1000;
    const tick = setInterval(() => {
      const left = Math.max(0, deadline.current - Date.now());
      setNextRowIn(Math.ceil(left / 1000));
      if (left <= 0) {
        deadline.current = Date.now() + ROW_SECONDS * 1000;
        spawnRow();
      }
    }, 200);
    return () => clearInterval(tick);
  }, [status, ready, spawnRow]);

  // Drop finished bursts.
  useEffect(() => {
    if (booms.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setBooms((list) => list.filter((b) => b.until > now));
    }, 200);
    return () => clearInterval(timer);
  }, [booms.length]);

  const restart = useCallback(() => {
    nextId = 1;
    commit(makeWall());
    setScore(0);
    setBooms([]);
    setStatus("playing");
    deadline.current = Date.now() + ROW_SECONDS * 1000;
    setNextRowIn(ROW_SECONDS);
  }, [commit]);

  const onReady = useCallback(() => setReady(true), []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#050506]">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [2.96, 4.3, 0], fov: 42, near: 0.05, far: 60 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ camera }) => camera.lookAt(0, BED.y + 0.02, 0)}
      >
        <color attach="background" args={["#050506"]} />
        <fog attach="fog" args={["#050506", 6, 22]} />
        <EnvSetup />
        <ambientLight intensity={0.3} />

        <spotLight
          position={[-0.62, 2.25, 0.05]}
          angle={0.72}
          penumbra={0.75}
          intensity={17}
          distance={4.6}
          decay={2}
          color="#fff6e2"
          castShadow={false}
          target-position={[-0.62, BED.y, 0.05]}
        />
        <spotLight
          position={[0.62, 2.25, 0.05]}
          angle={0.72}
          penumbra={0.75}
          intensity={17}
          distance={4.6}
          decay={2}
          color="#fff6e2"
          castShadow={false}
          target-position={[0.62, BED.y, 0.05]}
        />
        <spotLight
          position={[0, 2.35, 0]}
          angle={0.8}
          penumbra={0.8}
          intensity={16}
          distance={5}
          decay={2}
          color="#fff6e2"
          castShadow={false}
          target-position={[0, BED.y, 0]}
        />
        <directionalLight position={[1.3, 2.6, 1.4]} intensity={0.85} color="#ffe9c8" castShadow />

        <Table />
        <Midline />

        {bricks.map((b) => (
          <BrickMesh key={b.id} brick={b} />
        ))}
        {booms.map((b) => (
          <Burst key={b.id} kind={b.kind} x={b.x} z={b.z} />
        ))}

        <Handler />
        <Physics
          bricks={bricks}
          onHit={hit}
          onReady={onReady}
          frozen={status !== "playing"}
        />

        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#060606" roughness={1} metalness={0} />
        </mesh>
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <a
            href="/"
            aria-label="Back to the hall"
            className="pointer-events-auto mb-3 inline-flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
          >
            <span aria-hidden="true">&larr;</span> Hall
          </a>
          <p className="font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500">Score</p>
            <p className="font-display text-2xl tabular-nums text-zinc-100">{score}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Bricks
            </p>
            <p className="font-display text-2xl tabular-nums text-zinc-100">{bricks.length}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Next row
            </p>
            <p className="font-display text-2xl tabular-nums text-amber-300">{nextRowIn}s</p>
          </div>
        </div>

        <p className="mx-auto rounded-sm bg-black/55 px-3 py-1 text-center font-display text-[9px] uppercase tracking-[0.16em] text-zinc-400">
          mouse slides the handler · click to serve · clear the wall before it crosses the line
        </p>
      </div>

      {status !== "playing" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="rounded-md border border-white/10 bg-zinc-950/90 px-8 py-6 text-center">
            <p className="font-display text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {status === "won" ? "wall cleared" : "the wall crossed the line"}
            </p>
            <p className="font-display mt-2 text-3xl text-zinc-100">
              {status === "won" ? "You win" : "You lose"}
            </p>
            <p className="font-display mt-1 text-sm text-amber-300">{score} points</p>
            <button
              type="button"
              onClick={restart}
              className="mt-5 rounded-sm border border-white/15 px-5 py-2 font-display text-[10px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white/40 hover:text-white"
            >
              Play again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
