"use client";

import { useMemo } from "react";

import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { makeWoodTextures } from "@/lib/jenga/wood";

/**
 * Billiard table, environment only. No physics and no rules yet: this is the room,
 * the table and the balls, seen from where a player stands.
 *
 * Dimensions are real: an 8-foot table plays 2.24 m by 1.12 m, the balls are 57 mm,
 * and the bed sits 0.78 m off the floor.
 */

const BED = { w: 2.24, d: 1.12, y: 0.78 };
const RAIL = 0.1;
const RAIL_H = 0.085;
const CUSHION = 0.045;
const BALL_R = 0.0286;

const FELT = "#1f6b45";
const FELT_DARK = "#175236";
const CLOTH_ROUGHNESS = 0.95;

/** Classic ball set. Solids 1-7, 8 black, stripes 9-15. */
const BALL_COLORS: { id: number; color: string; stripe: boolean }[] = [
  { id: 1, color: "#e8b422", stripe: false },
  { id: 2, color: "#1f4fa8", stripe: false },
  { id: 3, color: "#c22a2a", stripe: false },
  { id: 4, color: "#5b2b8a", stripe: false },
  { id: 5, color: "#e2731f", stripe: false },
  { id: 6, color: "#1f7a4a", stripe: false },
  { id: 7, color: "#7a2d2d", stripe: false },
  { id: 8, color: "#141414", stripe: false },
  { id: 9, color: "#e8b422", stripe: true },
  { id: 10, color: "#1f4fa8", stripe: true },
  { id: 11, color: "#c22a2a", stripe: true },
  { id: 12, color: "#5b2b8a", stripe: true },
  { id: 13, color: "#e2731f", stripe: true },
  { id: 14, color: "#1f7a4a", stripe: true },
  { id: 15, color: "#7a2d2d", stripe: true },
];

/** Rack: apex ball nearest the cue ball, rows widening away from it. */
function rackPositions(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const apexX = BED.w / 2 - 0.36;
  const dx = BALL_R * 2 * 0.866;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      out.push({
        x: apexX + row * dx,
        z: (i - row / 2) * (BALL_R * 2.02),
      });
    }
  }
  return out;
}

function Ball({ color, stripe, x, z }: { color: string; stripe: boolean; x: number; z: number }) {
  return (
    <group position={[x, BED.y + BALL_R, z]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[BALL_R, 48, 32]} />
        <meshStandardMaterial color={color} roughness={0.18} metalness={0.02} envMapIntensity={0.6} />
      </mesh>
      {stripe ? (
        <mesh rotation={[0, 0, Math.PI / 2]} scale={[1.001, 1.001, 1.001]}>
          <cylinderGeometry args={[BALL_R * 0.999, BALL_R * 0.999, BALL_R * 1.02, 48, 1, true]} />
          <meshStandardMaterial color="#f4f1e6" roughness={0.22} transparent opacity={0.55} />
        </mesh>
      ) : null}
    </group>
  );
}

function Pocket({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, BED.y + 0.002, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.062, 0.062, 0.06, 28]} />
      <meshStandardMaterial color="#050505" roughness={0.95} metalness={0} />
    </mesh>
  );
}

function Table() {
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
  const { w, d, y } = BED;
  const outerW = w + RAIL * 2;
  const outerD = d + RAIL * 2;

  const pockets = useMemo(() => {
    const halfW = w / 2;
    const halfD = d / 2;
    return [
      [-halfW, -halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
      [0, -halfD],
      [0, halfD],
    ] as [number, number][];
  }, [w, d]);

  return (
    <group>
      {/* Bed: the slate, covered in cloth. */}
      <mesh position={[0, y, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color={FELT} roughness={CLOTH_ROUGHNESS} metalness={0} />
      </mesh>

      {/* A darker cloth lip under the rails, so the bed looks recessed. */}
      <mesh position={[0, y - 0.005, 0]} receiveShadow>
        <boxGeometry args={[w + 0.02, 0.045, d + 0.02]} />
        <meshStandardMaterial color={FELT_DARK} roughness={CLOTH_ROUGHNESS} />
      </mesh>

      {/* Rails, with a cushion face inside. */}
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

      {/* Cushions: a soft green bevel inside each rail. */}
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

      {pockets.map(([px, pz], i) => (
        <Pocket key={i} x={px} z={pz} />
      ))}

      {/* Apron and legs. */}
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

export function PoolTable() {
  const rack = useMemo(() => rackPositions(), []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#050506]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.62, 2.85], fov: 46, near: 0.05, far: 60 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ camera }) => camera.lookAt(0, BED.y + 0.02, 0)}
      >
        <color attach="background" args={["#050506"]} />
        <fog attach="fog" args={["#050506", 6, 22]} />

        <ambientLight intensity={0.22} />

        {/* Two lamps over the bed, as a pool room has. */}
        <spotLight
          position={[-0.62, 2.25, 0.05]}
          angle={0.72}
          penumbra={0.75}
          intensity={38}
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
          intensity={38}
          distance={4.6}
          decay={2}
          color="#fff6e2"
          castShadow={false}
          target-position={[0.62, BED.y, 0.05]}
        />

        <directionalLight position={[1.3, 2.6, 1.4]} intensity={0.85} color="#ffe9c8" castShadow />

        <Table />

        <Ball color="#f7f4ea" stripe={false} x={-BED.w / 2 + 0.3} z={0.02} />
        {BALL_COLORS.map((b, i) => (
          <Ball key={b.id} color={b.color} stripe={b.stripe} x={rack[i].x} z={rack[i].z} />
        ))}

        {/* Room floor, dark, so the table reads as an object in a space. */}
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
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
            Table
          </p>
        </div>
        <p className="mx-auto rounded-sm bg-black/55 px-3 py-1 text-center font-display text-[9px] uppercase tracking-[0.16em] text-zinc-400">
          environment only · no rules yet
        </p>
      </div>
    </div>
  );
}
