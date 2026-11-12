"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { makeWoodTextures } from "@/lib/jenga/wood";
import WALLS from "@/lib/pinball/table-walls.json";

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
const DIVIDER_Z = -HALF_W + 0.012 + LANE_W - 0.008;

// Centre of the real lane: between the outer wall's inner face and the divider's
// lane-side face. LANE_W is not the clear width, because the divider is a slab.
const CORRIDOR_Z = (-HALF_W + 0.012 + (DIVIDER_Z - 0.008)) / 2;

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
const TOP_RAMP = { x: -0.368, z: -0.2 };

const CIRCUIT: [number, number][] = [
  [-0.3, -HALF_W + 0.012],
  [TOP_RAMP.x, TOP_RAMP.z],
];

const RAIL = 0.05;
const RAIL_H = 0.055;

const SLATE = "#1d222a";
const NEON = "#22e0ff";
const NEON_VIOLET = "#a06bff";
const AMBER = "#ffd166";

const BALL_R = 0.0135;

/**
 * The head of the table: a semicircle from the left rail round to the lane divider.
 * A straight wall corners the ball and spits it back; a curve returns it to the field.
 */
const TOP_ARC: [number, number][] = (() => {
  const cx = -0.31;
  const cz = M(0);
  const r = Math.hypot(TOP_RAMP.x - cx, TOP_RAMP.z - cz);
  const a0 = Math.PI / 2;
  let a1 = Math.atan2(TOP_RAMP.z - cz, TOP_RAMP.x - cx);
  if (a1 < a0) a1 += Math.PI * 2;
  return Array.from({ length: 13 }, (_, i): [number, number] => {
    const a = a0 + (i / 12) * (a1 - a0);
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });
})();

/** Bumper positions, from the layout sheets:
 * field, and two larger ones flanking the middle. Both the visuals and the colliders
 * read this list, so they cannot drift apart.
 */
const BUMPERS: { x: number; dz: number; color: string; value: number }[] = [
  // Upper cluster: two side by side and one below, as in the layout sheet.
  { x: -0.18, dz: -0.095, color: "#a06bff", value: 30 },
  { x: -0.18, dz: 0.095, color: "#22e0ff", value: 20 },
  { x: -0.27, dz: 0, color: "#ffd166", value: 10 },
  // Centre pair, above the flippers: anything coming back down the middle is sent
  // back up the table.
  { x: -0.02, dz: 0, color: "#ffd166", value: 10 },
  { x: 0.12, dz: 0, color: "#22e0ff", value: 20 },
];
const PLUNGER_X = HALF_L - 0.115;

/** Flipper geometry in radians. Each bat sweeps exactly 30 degrees and comes back. */
const FLIP_REST = 0.785;
const FLIP_SWING = 0.524;
const DOWNHILL = 1.5;
const MAX_SPEED = 5.2;

const FLIPPER = { len: 0.1, thick: 0.014, width: 0.028 };
const FLIP_SPEED = 26;

const PART_WALL = new THREE.MeshStandardMaterial({
  color: "#07080b",
  roughness: 0.22,
  metalness: 0.55,
});
const PART_WALL_EDGE = new THREE.MeshStandardMaterial({
  color: "#14171c",
  roughness: 0.3,
  metalness: 0.5,
});
const PART_METAL = new THREE.MeshStandardMaterial({
  color: "#252a31",
  roughness: 0.32,
  metalness: 0.85,
});
const PART_STEEL = new THREE.MeshStandardMaterial({
  color: "#c3c9d1",
  roughness: 0.22,
  metalness: 0.95,
});
const PART_RED = new THREE.MeshStandardMaterial({
  color: "#c8202a",
  roughness: 0.3,
  metalness: 0.12,
});
const PART_AMBER = new THREE.MeshStandardMaterial({
  color: "#e08a1e",
  roughness: 0.3,
  metalness: 0.08,
});
const PART_DARK = new THREE.MeshStandardMaterial({
  color: "#15181c",
  roughness: 0.5,
  metalness: 0.15,
});
const PART_CREAM = new THREE.MeshStandardMaterial({
  color: "#f1ebdf",
  roughness: 0.42,
  metalness: 0.05,
});
const PART_RUBBER = new THREE.MeshStandardMaterial({
  color: "#14171b",
  roughness: 0.62,
  metalness: 0.1,
});

/** One Blender part, with the named meshes given the materials we want. */
function GltfPart({
  url,
  mapping,
  position,
  rotation,
  scale,
}: {
  url: string;
  mapping: Record<string, THREE.Material>;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const key = Object.keys(mapping).find((name) => mesh.name.includes(name));
      if (key) mesh.material = mapping[key];
    });
    return root;
  }, [scene, mapping]);

  return (
    <primitive
      object={object}
      position={position}
      rotation={rotation}
      scale={scale ?? 1}
    />
  );
}

const shared = {
  ball: null as RAPIER.RigidBody | null,
  /** Bumper index -> time it was last struck, for the light. */
  flash: {} as Record<number, number>,
  charge: 0,
  plungerHeld: false,
  score: 0,
  slingKicks: 0,
  bumperKicks: 0,
  /** Plate side -> time it was last struck, for the flash. */
  slingFlash: { 1: 0, [-1]: 0 } as Record<number, number>,
  combo: 0,
  comboAt: 0,
  onScore: null as ((v: number) => void) | null,
  onCombo: null as ((v: number) => void) | null,
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

/** A bell's face: sunburst ring and point value, drawn to a canvas. */
function makeBellFace(value: number, color: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#f4f1e6";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size / 2 + Math.cos(a) * (size / 2 - 4), size / 2 + Math.sin(a) * (size / 2 - 4));
    ctx.lineTo(
      size / 2 + Math.cos(a + 0.13) * (size / 2 - 30),
      size / 2 + Math.sin(a + 0.13) * (size / 2 - 30),
    );
    ctx.lineTo(
      size / 2 + Math.cos(a - 0.13) * (size / 2 - 30),
      size / 2 + Math.sin(a - 0.13) * (size / 2 - 30),
    );
    ctx.fill();
  }

  ctx.fillStyle = "#101418";
  ctx.font = "bold 104px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), size / 2, size / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Pop bumper: drum, neon cap, and a skirt in the colour of the reference objects. */
function Bumper({
  id,
  x,
  z,
  color = NEON,
  value = 10,
}: {
  id: number;
  x: number;
  z: number;
  color?: string;
  value?: number;
}) {
  const { scene } = useGLTF("/models/pinball/bumper.glb");
  const cap = useRef<THREE.MeshStandardMaterial | null>(null);

  const object = useMemo(() => {
    // A darker cap, so the white face and its number stand out.
    const capMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(0.42),
      emissive: new THREE.Color(color).multiplyScalar(0.5),
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.25,
    });
    cap.current = capMaterial;

    const root = scene.clone(true);
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const lit =
        mesh.name.includes("Cap") ||
        mesh.name.includes("Crown") ||
        mesh.name.includes("Core");
      mesh.material = lit ? capMaterial : PART_METAL;
    });
    return root;
  }, [scene, color]);

  useFrame(() => {
    const material = cap.current;
    if (!material) return;
    const struck = shared.flash[id] ?? 0;
    const since = (performance.now() - struck) / 1000;
    const level = since < 0.35 ? 1 - since / 0.35 : 0;
    material.emissiveIntensity = 0.55 + level * 5;
  });

  const face = useMemo(() => makeBellFace(value, color), [value, color]);

  return (
    <group position={[x, PLAY.y, z]}>
      <primitive object={object} />
      <mesh position={[0, 0.0435, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0225, 48]} />
        <meshBasicMaterial map={face} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The amber plate traced from the artwork, one per arm corner. */
function Slingshot({ side }: { side: 1 | -1 }) {
  const { x, z, theta } = slingPlacement(side);
  const group = useRef<THREE.Group>(null);

  // A short kick pulse, so the boost is visible as well as felt.
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const struck = shared.slingFlash[side] ?? 0;
    const since = (performance.now() - struck) / 1000;
    const level = since < 0.22 ? 1 - since / 0.22 : 0;
    g.scale.setScalar(1 + level * 0.16);
  });

  return (
    <group ref={group} position={[x, PLAY.y + 0.008, z]}>
      <GltfPart
        url="/models/pinball/slingshot.glb"
        mapping={SLING_MAP}
        position={[0, 0, 0]}
        rotation={[0, theta, 0]}
      />
    </group>
  );
}

const LANE_MAP = {
  Arm: PART_METAL,
  ArmRun: PART_METAL,
  ArmElbow: PART_METAL,
  Border: PART_CREAM,
  BorderRun: PART_CREAM,
  BorderElbow: PART_CREAM,
  Hinge: PART_CREAM,
  Screw: PART_STEEL,
};

const ARM_ROTATION = Math.PI;

const WALL_MAP = {
  Body: PART_WALL,
  Plinth: PART_WALL_EDGE,
  Cap: PART_WALL_EDGE,
};

/** Divider, head curve and lane exit, modelled in Blender in world coordinates. */
function TableWalls() {
  return (
    <GltfPart
      url="/models/pinball/table_walls.glb"
      mapping={WALL_MAP}
      position={[0, PLAY.y, 0]}
    />
  );
}


/** The black curved guide that carries the ball down to a flipper. */
function LaneWall({ side }: { side: 1 | -1 }) {
  return (
    <GltfPart
      url={side > 0 ? "/models/pinball/lane_arm.glb" : "/models/pinball/lane_arm_right.glb"}
      mapping={LANE_MAP}
      position={[0.34, PLAY.y + 0.004, M(side * 0.112)]}
      rotation={[0, ARM_ROTATION, 0]}
    />
  );
}

// Names come from the traced PNG layers.
const SLING_MAP = {
  Casing: PART_CREAM,
  Frame: PART_DARK,
  Face: PART_AMBER,
  Screw: PART_STEEL,
};

// From the trace of the artwork:
//   obtuse corner (94.7 deg) at (-0.040, -0.013); centroid at (-0.004, -0.003)
//   its two edges run toward (0.040, -0.048) and (-0.017, 0.055)
// The obtuse corner sits on the arm's elbow, and its two edges straddle the arm's
// upper run symmetrically, so the bisector is turned onto that run.
const SLING_CORNER = { x: -0.0367, z: 0.0099 };   // centroid -> obtuse corner
// One bisector per side: the two plates are turned independently.
const SLING_BISECTOR_LEFT = { x: 0.017, z: -0.399 };    // left plate
const SLING_BISECTOR_RIGHT = { x: 0.527, z: 0.399 };    // right plate, mirrored — adjust here

/** Elbow of each arm, where its two runs meet. */
const ELBOW = { x: 0.232, z: 0.2595 };
const ELBOW_RIGHT = { x: 0.232, z: -0.2045 };

/** Each arm's upper run leaves the elbow straight up-table. */
const ARM_RUN = { x: -1, z: 0 };

function rotate2(v: { x: number; z: number }, theta: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: v.x * c + v.z * s, z: -v.x * s + v.z * c };
}

function angleTo(from: { x: number; z: number }, to: { x: number; z: number }) {
  return Math.atan2(from.z * to.x - from.x * to.z, from.x * to.x + from.z * to.z);
}

/** Turn the obtuse angle's bisector onto the arm's upper run, corner on the elbow. */
function slingPlacement(side: 1 | -1) {
  const elbow = side > 0 ? ELBOW : ELBOW_RIGHT;
  const bisector = side > 0 ? SLING_BISECTOR_LEFT : SLING_BISECTOR_RIGHT;
  const theta = angleTo(bisector, ARM_RUN);
  const corner = rotate2(SLING_CORNER, theta);
  return { x: elbow.x - corner.x, z: elbow.z - corner.z, theta };
}




/**
 * Flipper: the long tapered bat from the sample, with a dark rubber band around the
 * edge and a machined hub. Built along +x so a single rotation aims it.
 */
function FlipperMesh({ side }: { side: 1 | -1 }) {
  const mapping = useMemo(
    () => ({
      FlipperBorder: PART_CREAM,
      Flipper: PART_RED,
      PivotScrew: PART_STEEL,
    }),
    [],
  );

  return (
    <>
      <GltfPart url="/models/pinball/flipper.glb" mapping={mapping} />
      <mesh position={[FLIPPER.len - 0.03, 0, 0.011]}>
        <boxGeometry args={[0.008, 0.004, 0.001]} />
        <meshBasicMaterial color={side > 0 ? NEON : NEON_VIOLET} toneMapped={false} />
      </mesh>
    </>
  );
}

/** The plunger: a spring and shooter rod at the bottom of the lane. */
function PlungerSpring() {
  const spring = useRef<THREE.Group>(null);

  useFrame(() => {
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
const POST_MAP = { Shaft: PART_METAL, Head: PART_STEEL };

function Post({ x, z }: { x: number; z: number }) {
  return (
    <GltfPart url="/models/pinball/post.glb" mapping={POST_MAP} position={[x, PLAY.y, z]} />
  );
}

// ------------------------------------------------------------------ physics + ball

function Pinball({
  onScore,
  onCharge,
  onCombo,
}: {
  onScore: (v: number) => void;
  onCharge: (v: number) => void;
  onCombo: (v: number) => void;
}) {
  const { camera, gl } = useThree();
  const ballMesh = useRef<THREE.Mesh>(null);
  const ballRoot = useRef<THREE.Group>(null);
  const liveBall = useRef<RAPIER.RigidBody | null>(null);
  const { scene: ballScene } = useGLTF("/models/pinball/ball.glb");
  const ballModel = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "#d8dde4",
      roughness: 0.1,
      metalness: 0.95,
      clearcoat: 0.6,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.1,
    });
    const root = ballScene.clone(true);
    root.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = material;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return root;
  }, [ballScene]);
  const leftFlip = useRef<THREE.Group>(null);
  const rightFlip = useRef<THREE.Group>(null);
  const leftBody = useRef<RAPIER.RigidBody | null>(null);
  const rightBody = useRef<RAPIER.RigidBody | null>(null);
  const world = useRef<RAPIER.World | null>(null);
  const acc = useRef(0);
  const events = useRef<RAPIER.EventQueue | null>(null);
  const scoring = useRef<Record<number, number>>({});
  const bumperAt = useRef(new Map<number, { x: number; z: number }>()).current;
  const bumperHandles = useRef(new Map<number, number>());
  const slingSides = useRef(new Map<number, number>());
  const bumperCooldown = useRef<Record<number, number>>({});
  const stalled = useRef(0);
  const slingCooldown = useRef<Record<number, number>>({});
  const [ready, setReady] = useState(false);
  const cleanups = useRef<(() => void)[]>([]);
  const mode = useRef<"idle" | "play">("idle");
  const exitCooldown = useRef(0);
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
      box((HALF_L + 0.3) / 2, 0.012, (HALF_L - 0.3) / 2, -HALF_W, 0.5);

      // Head curve, corridor divider and lane exit: colliders built from the same
      // segment list Blender used to model them, so mesh and physics cannot drift.
      for (const seg of WALLS.segments) {
        const dx = seg.x1 - seg.x0;
        const dz = seg.z1 - seg.z0;
        const len = Math.hypot(dx, dz);
        if (len < 1e-5) continue;
        w.createCollider(
          RAPIER.ColliderDesc.cuboid(len / 2, seg.halfHeight, seg.halfWidth)
            .setTranslation(
              (seg.x0 + seg.x1) / 2,
              PLAY.y + seg.halfHeight,
              (seg.z0 + seg.z1) / 2,
            )
            .setRotation(quatFromY(Math.atan2(-dz, dx)))
            .setFriction(0.04)
            .setRestitution(0.5),
        );
      }

      // The slingshot plates are deliberately NOT solid: a solid body trapped the
      // ball against them. They kick by proximity instead, below.

      // Funnels: two walls per side running from the side rail down to the flipper
      // pivot. Anything coming down the side is delivered onto a flipper, which is
      // what keeps the ball alive.
      for (const side of [1, -1] as const) {
        const pts: [number, number][] = [
          // Upper end meets the side wall, so nothing can perch on the tip or slip
          // behind it.
          [0.04, side > 0 ? HALF_W - 0.012 : DIVIDER_Z + 0.008],
          [0.2, M(side * 0.16)],
          // Lower end lands on the flipper hinge.
          [0.34, M(side * 0.112)],
        ];
        for (let i = 0; i < pts.length - 1; i += 1) {
          const [x0, z0] = pts[i];
          const [x1, z1] = pts[i + 1];
          const dx = x1 - x0;
          const dz = z1 - z0;
          const len = Math.hypot(dx, dz);
          w.createCollider(
            RAPIER.ColliderDesc.cuboid(len / 2, 0.03, 0.007)
              .setTranslation((x0 + x1) / 2, PLAY.y + 0.03, (z0 + z1) / 2)
              .setRotation(quatFromY(Math.atan2(-dz, dx)))
              .setFriction(0.05)
              .setRestitution(0.35),
          );
          if (i === 0) {
            w.createCollider(
              RAPIER.ColliderDesc.cylinder(0.03, 0.009)
                .setTranslation(x0, PLAY.y + 0.03, z0)
                .setFriction(0.05)
                .setRestitution(0.4),
            );
          }
        }
      }

      // Bumpers: one collider each, from the shared list.
      bumperAt.clear();
      BUMPERS.forEach((b) => {
        const z = M(b.dz);
        const c = w.createCollider(
          RAPIER.ColliderDesc.ball(0.034)
            .setTranslation(b.x, PLAY.y + 0.034, z)
            .setFriction(0.02)
            .setRestitution(0.9),
        );
        scoring.current[c.handle] = b.value;
        bumperAt.set(c.handle, { x: b.x, z });
        bumperHandles.current.set(c.handle, BUMPERS.indexOf(b));
      });

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
            .setFriction(0.06)
            .setRestitution(0.66),
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
      liveBall.current = ball;
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
      (window as unknown as { __place?: (x: number, z: number) => void }).__place = (
        x: number,
        z: number,
      ) => {
        const ball = liveBall.current;
        if (!ball) return;
        mode.current = "play";
        ball.setTranslation({ x, y: PLAY.y + 0.03, z }, true);
        ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      };
      (window as unknown as { __kick?: (vx: number, vz: number) => void }).__kick = (
        vx: number,
        vz: number,
      ) => {
        const ball = liveBall.current;
        if (!ball) return;
        mode.current = "play";
        ball.setLinvel({ x: vx, y: 0, z: vz }, true);
      };
      (window as unknown as { __pin?: () => unknown }).__pin = () => {
        if (!liveBall.current || !world.current) return { x: 0, y: 0, z: 0, vx: 0, vz: 0, charge: 0, mode: "idle", held: false, slingKicks: 0, bumperKicks: 0 };
        const ball = liveBall.current;
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
          slingKicks: shared.slingKicks,
          bumperMap: bumperAt.size,
          slingMap: slingSides.current.size,
          bumperKicks: shared.bumperKicks,
        };
      };
      shared.onScore = onScore;
      shared.onCombo = onCombo;
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
          const speed = 1.4 + shared.charge * 2.9;
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
      // Drop the live handle too, and the debug hooks with it: a stale handle points
      // into freed wasm memory and throws on the next read.
      liveBall.current = null;
      const w = window as unknown as Record<string, unknown>;
      delete w.__pin;
      delete w.__kick;
      delete w.__place;
      delete w.__at;
      delete w.__near;
      delete w.__ghost;
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

    if (shared.combo > 0 && performance.now() - shared.comboAt > 2600) {
      shared.combo = 0;
      shared.onCombo?.(0);
    }

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
    const swing = FLIP_SPEED * delta;
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
          // Each hit lands for more while the chain is warm.
          const multiplier = 1 + shared.combo;
          shared.score += value * multiplier;
          shared.onScore?.(shared.score);
        }

        // A slingshot throws the ball back out in a random direction, biased away
        // from its rail and up the table.
        const slingSide = slingSides.current.get(h1) ?? slingSides.current.get(h2);
        if (slingSide !== undefined) {
          shared.slingKicks += 1;
          const inward = slingSide > 0 ? -1 : 1;
          const railZ = slingSide > 0 ? 0.27 : -0.203;
          const plateZ = railZ - slingSide * 0.025;
          const speed = 3.4 + Math.random() * 1.4;
          const spread = (Math.random() - 0.5) * (Math.PI * 0.72);
          const vz = Math.cos(spread) * inward * speed;
          const vx = Math.sin(spread) * speed - 1.1;

          // The ball is usually inside the plate when the contact fires; move it clear
          // first, or the solver spends the kick pushing it out of the geometry.
          const t = ball.translation();
          ball.setTranslation(
            { x: t.x, y: PLAY.y + 0.025, z: plateZ + inward * 0.05 },
            true,
          );
          ball.setLinvel({ x: vx, y: 0.15, z: vz }, true);
        }

        // A bumper does not just bounce the ball, it fires it away.
        const bumper = bumperAt.get(h1) ?? bumperAt.get(h2);
        if (bumper) {
          shared.bumperKicks += 1;
          const id = bumperHandles.current.get(h1) ?? bumperHandles.current.get(h2);
          if (id !== undefined) shared.flash[id] = performance.now();

          shared.combo = Math.min(6, shared.combo + 1);
          shared.comboAt = performance.now();
          shared.onCombo?.(shared.combo);

          const t = ball.translation();
          const dx = t.x - bumper.x;
          const dz = t.z - bumper.z;
          const len = Math.hypot(dx, dz);
          // Directly above the centre there is no radial direction to use, so fall
          // back to a fixed one; otherwise the ball just sits there.
          const dir =
            len > 0.004
              ? { x: dx / len, z: dz / len }
              : { x: 0.6, z: t.z >= bumper.z ? 0.8 : -0.8 };
          const v = ball.linvel();
          const incoming = Math.hypot(v.x, v.z);
          const outSpeed = Math.min(6.5, Math.max(2.8, incoming * 0.85 + 2.2));
          ball.setLinvel(
            { x: dir.x * outSpeed, y: 0.35, z: dir.z * outSpeed },
            true,
          );
        }
      });
    }

    const t = ball.translation();
    const r = ball.rotation();
    if (ballRoot.current) {
      ballRoot.current.position.set(t.x, t.y, t.z);
      ballRoot.current.quaternion.set(r.x, r.y, r.z, r.w);
    }

    // Bells and slingshots are triggered by proximity rather than by collision
    // handle: it is deterministic, and it cannot be broken by a collider handle
    // changing when the world is rebuilt.
    if (mode.current === "play") {
      const t = ball.translation();
      const now = performance.now();

      BUMPERS.forEach((b, index) => {
        const bz = M(b.dz);
        const dx = t.x - b.x;
        const dz = t.z - bz;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.05) return;
        if (now < (bumperCooldown.current[index] ?? 0)) return;
        bumperCooldown.current[index] = now + 220;

        shared.flash[index] = now;
        shared.combo = Math.min(6, shared.combo + 1);
        shared.comboAt = now;
        shared.onCombo?.(shared.combo);

        const value = b.value * (1 + shared.combo);
        shared.score += value;
        shared.onScore?.(shared.score);

        const len = distance || 1;
        const dir = distance > 0.004 ? { x: dx / len, z: dz / len } : { x: 0.6, z: 0.8 };
        const v = ball.linvel();
        const incoming = Math.hypot(v.x, v.z);
        const outSpeed = Math.min(6.5, Math.max(2.8, incoming * 0.85 + 2.2));
        ball.setLinvel({ x: dir.x * outSpeed, y: 0.35, z: dir.z * outSpeed }, true);
      });

      for (const side of [1, -1] as const) {
        const plate = slingPlacement(side);
        const dx = t.x - plate.x;
        const dz = t.z - plate.z;
        if (Math.hypot(dx, dz) > 0.062) continue;
        if (now < (slingCooldown.current[side] ?? 0)) continue;
        slingCooldown.current[side] = now + 260;

        const inward = side > 0 ? -1 : 1;
        const incoming = Math.hypot(ball.linvel().x, ball.linvel().z);

        // Bounce off the face the ball actually hit, then add the boost on top. The
        // spread keeps it unpredictable, as on a real slingshot.
        const awayX = t.x - plate.x;
        const awayZ = t.z - plate.z;
        const awayLen = Math.hypot(awayX, awayZ) || 1;
        const base = Math.atan2(awayZ / awayLen, awayX / awayLen);
        const spread = (Math.random() - 0.5) * (Math.PI * 0.5);
        const angle = base + spread;

        const boost = Math.min(
          MAX_SPEED,
          Math.max(3.9, incoming * 1.3 + 1.3),
        );
        const vx = Math.cos(angle) * boost;
        const vz = Math.sin(angle) * boost;

        shared.score += 25;
        shared.onScore?.(shared.score);
        shared.slingFlash[side] = now;

        ball.setTranslation(
          { x: t.x, y: PLAY.y + 0.025, z: plate.z + inward * 0.06 },
          true,
        );
        ball.setLinvel({ x: vx, y: 0.15, z: vz }, true);
      }
    }

    // Keep the ball inside the range a real table can reach, and never let it come to
    // a permanent stop on the playfield: a dead ball is a soft lock, not a skill shot.
    if (mode.current === "play") {
      const v = ball.linvel();
      const speed = Math.hypot(v.x, v.z);
      if (speed > MAX_SPEED) {
        const k = MAX_SPEED / speed;
        ball.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
      } else if (speed < 0.08) {
        stalled.current += 1;
        if (stalled.current > 45) {
          stalled.current = 0;
          ball.setLinvel(
            { x: -0.9 - Math.random() * 0.5, y: 0.1, z: (Math.random() - 0.5) * 1.2 },
            true,
          );
        }
      } else {
        stalled.current = 0;
      }
    }

    // Lane exit. The shooter lane ends in a gate on a real table; here the ball is
    // turned into the field the moment it reaches the top of the lane, once per
    // approach, so it can never come back down the chute.
    if (mode.current === "play") {
      const here = ball.translation();
      const now = performance.now();
      const v = ball.linvel();
      // Strictly inside the lane (not the field) and still travelling up it.
      if (
        here.x < -0.24 &&
        here.z < DIVIDER_Z - 0.004 &&
        here.z > -0.262 &&
        v.x < 0.3 &&
        now > exitCooldown.current
      ) {
        const speed = Math.max(2.4, Math.hypot(v.x, v.z));
        ball.setLinvel({ x: -0.32 * speed, y: 0, z: 0.95 * speed }, true);
        exitCooldown.current = now + 700;
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
      <group ref={ballRoot} position={[0, PLAY.y + BALL_R, 0]}>
        <primitive object={ballModel} />
      </group>

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
      ].map((r, i) => (
        <mesh key={`w${i}`} position={r.pos as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={r.size as [number, number, number]} />
          <meshStandardMaterial color="#33383f" roughness={0.3} metalness={0.75} />
        </mesh>
      ))}

      {BUMPERS.map((b, i) => (
        <Bumper key={i} id={i} x={b.x} z={M(b.dz)} color={b.color} />
      ))}

      <DropTargets />
      <RolloverRing z={M(0)} />
      <Spinner x={-0.1} z={M(0.185)} />
      <Spinner x={-0.1} z={M(-0.185)} />

      <PlungerSpring />
      <Slingshot side={1} />
      <Slingshot side={-1} />
      <Post x={0.3} z={M(0.2)} />
      <Post x={0.3} z={M(-0.2)} />

      <LaneWall side={1} />
      <LaneWall side={-1} />

      <TableWalls />

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

useGLTF.preload("/models/pinball/bumper.glb");
useGLTF.preload("/models/pinball/flipper.glb");
useGLTF.preload("/models/pinball/post.glb");
useGLTF.preload("/models/pinball/slingshot.glb");
useGLTF.preload("/models/pinball/lane_arm.glb");
useGLTF.preload("/models/pinball/lane_arm_right.glb");

export function PinballTable() {
  const [score, setScore] = useState(0);
  const [charge, setCharge] = useState(0);
  const [combo, setCombo] = useState(0);
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
        <spotLight
          position={[-0.25, 1.6, 0]}
          angle={0.85}
          penumbra={0.9}
          intensity={7}
          distance={3}
          decay={2}
          color="#fff2dc"
          target-position={[-0.3, PLAY.y, M(0)]}
        />
        <directionalLight position={[1.2, 2.4, 1.2]} intensity={0.8} color="#ffe9c8" castShadow />

        <Cabinet />
        <Pinball onScore={setScore} onCharge={setCharge} onCombo={setCombo} />

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
          <div className="text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Chain
            </p>
            <p
              className={`font-display text-2xl tabular-nums ${
                combo > 0 ? "text-amber-300" : "text-zinc-600"
              }`}
            >
              x{1 + combo}
            </p>
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
