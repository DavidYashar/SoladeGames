"use client";

import { useMemo } from "react";

import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { makeWoodTextures } from "@/lib/jenga/wood";

/**
 * Billiard table, environment only.
 *
 * Real dimensions: an 8-foot table plays 2.24 m by 1.12 m and the bed sits 0.78 m off
 * the floor. The camera stands at one short end and looks down the length of the table,
 * the way a player stands behind the break.
 */

const BED = { w: 2.24, d: 1.58, y: 0.78 };
const RAIL = 0.1;
const RAIL_H = 0.085;
const CUSHION = 0.045;

const FELT = "#1f6b45";
const FELT_DARK = "#175236";
const CLOTH_ROUGHNESS = 0.95;

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
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#050506]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [2.96, 4.3, 0], fov: 42, near: 0.05, far: 60 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ camera }) => camera.lookAt(0, BED.y + 0.02, 0)}
      >
        <color attach="background" args={["#050506"]} />
        <fog attach="fog" args={["#050506", 6, 22]} />

        <ambientLight intensity={0.3} />

        {/* Two lamps over the bed, as a pool room has. */}
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
