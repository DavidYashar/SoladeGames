"use client";

import { useMemo } from "react";

import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { makeWoodTextures } from "@/lib/jenga/wood";

/**
 * Neon Pinball, table only.
 *
 * Real scale: the playfield of a standard cabinet is about 0.52 m by 1.09 m and sits
 * roughly 0.85 m off the floor. The camera stands at the player's end at the same
 * 50 degrees we use on the billiard table, so the two cabinets read as one room.
 *
 * No physics yet. This is the table, the furniture on it, and the cabinet around it.
 */

const PLAY = { w: 0.54, l: 1.08, y: 0.85 };
const RAIL = 0.05;
const RAIL_H = 0.055;
const FLOOR_Y = 0;

const SLATE = "#1d222a";
const SLATE_LINE = "#2a2f37";
const NEON = "#22e0ff";
const NEON_VIOLET = "#a06bff";

const BALL_R = 0.0135;

function Slate() {
  const lines = useMemo(() => {
    const out: number[] = [];
    for (let z = -PLAY.w / 2 + 0.09; z < PLAY.w / 2; z += 0.09) out.push(z);
    return out;
  }, []);

  return (
    <group>
      <mesh position={[0, PLAY.y, 0]} receiveShadow>
        <boxGeometry args={[PLAY.l, 0.016, PLAY.w]} />
        <meshStandardMaterial color={SLATE} roughness={0.42} metalness={0.25} />
      </mesh>

      {/* Faint playfield guides, to give the surface scale. */}
      {lines.map((z) => (
        <mesh key={z} position={[0, PLAY.y + 0.0085, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PLAY.l - 0.04, 0.0012]} />
          <meshBasicMaterial color={SLATE_LINE} transparent opacity={0.5} toneMapped={false} />
        </mesh>
      ))}

      {/* Neon edge strips down both sides. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, PLAY.y + 0.009, (side * PLAY.w) / 2 - side * 0.012]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[PLAY.l - 0.12, 0.004]} />
          <meshBasicMaterial color={side > 0 ? NEON : NEON_VIOLET} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Pop bumper: a drum with a cap, the classic round target. */
function Bumper({ x, z, color = NEON }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, PLAY.y, z]}>
      <mesh position={[0, 0.018, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.026, 0.03, 0.036, 24]} />
        <meshStandardMaterial color="#20242b" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.038, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.026, 0.006, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.8}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.043, 0]}>
        <sphereGeometry args={[0.014, 16, 12]} />
        <meshStandardMaterial color="#0c0e12" roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Slingshot: the angled kicker beside each flipper. */
function Slingshot({ side }: { side: 1 | -1 }) {
  const z = side * 0.145;
  return (
    <group position={[0.12, PLAY.y, z]} rotation={[0, side * -0.42, 0]}>
      <mesh position={[0, 0.014, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.13, 0.026, 0.022]} />
        <meshStandardMaterial color="#23272e" roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.028, side * 0.004]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.004, 0.012]} />
        <meshStandardMaterial
          color={NEON_VIOLET}
          emissive={NEON_VIOLET}
          emissiveIntensity={1.6}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/** Flipper: a tapered bat on a post, angled down toward the drain. */
function Flipper({ side }: { side: 1 | -1 }) {
  const pivotZ = side * 0.105;
  return (
    <group position={[0.36, PLAY.y, pivotZ]} rotation={[0, -side * 0.5, 0]}>
      {/* Pivot post */}
      <mesh position={[0, 0.014, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.028, 16]} />
        <meshStandardMaterial color="#2b3038" roughness={0.35} metalness={0.8} />
      </mesh>
      {/* Bat */}
      <mesh position={[-0.055, 0.012, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.115, 0.016, 0.026]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.25} metalness={0.9} />
      </mesh>
      {/* Rubber edge, the part that actually hits */}
      <mesh position={[-0.055, 0.019, 0]}>
        <boxGeometry args={[0.112, 0.006, 0.03]} />
        <meshStandardMaterial
          color={NEON}
          emissive={NEON}
          emissiveIntensity={1.1}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

/** A drop-target bank: five plates that stand up from the playfield. */
function DropTargets({ x }: { x: number }) {
  return (
    <group position={[x, PLAY.y, 0]}>
      {[-0.05, -0.025, 0, 0.025, 0.05].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.014, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.008, 0.028, 0.019]} />
            <meshStandardMaterial color="#39404a" roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh position={[0.005, 0.022, 0]}>
            <boxGeometry args={[0.002, 0.008, 0.015]} />
            <meshStandardMaterial
              color="#ffd166"
              emissive="#ffd166"
              emissiveIntensity={1.2}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Small posts, arranged in the ring from the reference. */
function Posts() {
  const ring = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      out.push([Math.cos(a) * 0.13 - 0.02, Math.sin(a) * 0.1]);
    }
    return out;
  }, []);

  return (
    <group>
      {ring.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, PLAY.y + 0.014, z]} castShadow>
          <cylinderGeometry args={[0.005, 0.005, 0.028, 12]} />
          <meshStandardMaterial color="#8a9099" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** The plunger lane down the right side, with its spring and the shooter. */
function Plunger() {
  const laneZ = -(PLAY.w / 2 - 0.055);
  return (
    <group>
      {/* Lane divider */}
      <mesh position={[0.02, PLAY.y + 0.022, laneZ + 0.032]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.03, 0.01]} />
        <meshStandardMaterial color="#2a2f37" roughness={0.35} metalness={0.6} />
      </mesh>

      {/* Spring */}
      <group position={[0.44, PLAY.y, laneZ]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} position={[0.02 + i * 0.008, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.011, 0.0022, 8, 16]} />
            <meshStandardMaterial color="#b9c0c9" roughness={0.3} metalness={0.95} />
          </mesh>
        ))}
        {/* Shooter rod */}
        <mesh position={[0.005, 0.012, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.005, 0.005, 0.06, 12]} />
          <meshStandardMaterial color="#dfe4ea" roughness={0.25} metalness={1} />
        </mesh>
      </group>
    </group>
  );
}

/** The left habitrail arc, raised above the playfield as in the reference. */
function Habitrail() {
  return (
    <group position={[-0.3, PLAY.y + 0.09, -0.13]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.12, 0.008, 10, 40, Math.PI * 1.15]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.25} metalness={0.95} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0.11, -0.04 - i * 0.018, 0.09]}>
          <cylinderGeometry args={[0.004, 0.004, 0.05, 8]} />
          <meshStandardMaterial color="#7d838c" roughness={0.35} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Table() {
  // Built here, inside the Canvas: the texture helper needs `document`.
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

      {/* Cabinet sides */}
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

      {/* Inside walls the ball will bounce from. */}
      {[
        { pos: [0, PLAY.y + 0.02, PLAY.w / 2 + 0.006], size: [PLAY.l, 0.04, 0.012] },
        { pos: [0, PLAY.y + 0.02, -(PLAY.w / 2 + 0.006)], size: [PLAY.l, 0.04, 0.012] },
        { pos: [PLAY.l / 2 + 0.006, PLAY.y + 0.02, 0], size: [0.012, 0.04, PLAY.w] },
        { pos: [-(PLAY.l / 2 + 0.006), PLAY.y + 0.02, 0], size: [0.012, 0.04, PLAY.w] },
      ].map((r, i) => (
        <mesh key={`w${i}`} position={r.pos as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={r.size as [number, number, number]} />
          <meshStandardMaterial color="#33383f" roughness={0.3} metalness={0.75} />
        </mesh>
      ))}

      <Bumper x={-0.2} z={-0.11} />
      <Bumper x={-0.28} z={0} color={NEON_VIOLET} />
      <Bumper x={-0.2} z={0.11} />
      <Bumper x={-0.06} z={0} color="#ffd166" />

      <DropTargets x={-0.36} />
      <Posts />
      <Habitrail />

      <Slingshot side={1} />
      <Slingshot side={-1} />
      <Flipper side={1} />
      <Flipper side={-1} />
      <Plunger />

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

        <Table />

        <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[16, 16]} />
          <meshStandardMaterial color="#060606" roughness={1} metalness={0} />
        </mesh>
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <a
            href="/"
            className="pointer-events-auto font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-white"
          >
            ← Hall
          </a>
          <p className="font-display text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            Pinball
          </p>
        </div>
        <p className="mx-auto rounded-sm bg-black/55 px-3 py-1 text-center font-display text-[9px] uppercase tracking-[0.16em] text-zinc-400">
          table only · no physics yet
        </p>
      </div>
    </div>
  );
}
