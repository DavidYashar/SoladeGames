"use client";

import { useEffect, useMemo, useRef } from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { Mesh } from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { makeBallTexture, makeShadowTexture } from "@/lib/jenga/ball-skin";
import { makeWoodTextures } from "@/lib/jenga/wood";

/**
 * Billiard table with the three game pieces on it: a wall of bricks, the handler the
 * player controls, and a ball with real physics.
 *
 * Real dimensions: an 8-foot table plays 2.24 m by 1.12 m and the bed sits 0.78 m off
 * the floor. The bed is widened to 1.58 m so the play area reads better on screen.
 * The camera stands at one short end, 50 degrees above the bed.
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
const BRICK_ROWS = 5;
const BRICK_GAP = 0.02;
const BRICK_COLORS = ["#8a3a2c", "#9d4632", "#b0533a", "#c06343", "#cd7452"];

/** A little larger than a real 57 mm ball, because true scale is a dot on screen. */
const BALL_R = 0.042;
const FELT_TOP = BED.y + 0.02;

const HANDLER_X = 0.86;

interface BrickSpec {
  x: number;
  z: number;
  color: string;
}

function brickLayout(): BrickSpec[] {
  const out: BrickSpec[] = [];
  const startX = -0.98;
  const startZ = -((BRICK_COLS - 1) * (BRICK.w + BRICK_GAP)) / 2;
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      out.push({
        x: startX + row * (BRICK.d + BRICK_GAP),
        z: startZ + col * (BRICK.w + BRICK_GAP),
        color: BRICK_COLORS[row % BRICK_COLORS.length],
      });
    }
  }
  return out;
}

let rapierReady: Promise<void> | null = null;
function initRapier(): Promise<void> {
  if (!rapierReady) rapierReady = RAPIER.init();
  return rapierReady;
}

function BrickWall({ bricks }: { bricks: BrickSpec[] }) {
  return (
    <group>
      {bricks.map((b, i) => (
        <RoundedBox
          key={i}
          args={[BRICK.d, BRICK.h, BRICK.w]}
          radius={0.008}
          smoothness={2}
          position={[b.x, BED.y + BRICK.h / 2, b.z]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={b.color} roughness={0.78} metalness={0.02} />
        </RoundedBox>
      ))}
    </group>
  );
}

/** The handler: the bar the player moves, sitting near their end of the table. */
function Handler() {
  return (
    <group position={[HANDLER_X, BED.y + 0.032, 0]}>
      <RoundedBox args={[0.07, 0.055, 0.46]} radius={0.014} smoothness={2} castShadow receiveShadow>
        <meshStandardMaterial color="#2a2118" roughness={0.45} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.072, 0.008, 0.462]} />
        <meshStandardMaterial
          color="#7fd8ff"
          emissive="#2aa6d6"
          emissiveIntensity={1.4}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/**
 * The ball, as a rigid body.
 *
 * The table is static geometry: bed, four cushion faces, the brick wall and the
 * handler. The ball is launched at the wall once and then rolls, bounces and slows
 * down under its own damping, which is enough to see the mechanic working.
 */
function Ball({ bricks }: { bricks: BrickSpec[] }) {
  const { camera, gl } = useThree();
  const mesh = useRef<Mesh>(null);
  const world = useRef<RAPIER.World | null>(null);
  const body = useRef<RAPIER.RigidBody | null>(null);
  const acc = useRef(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await initRapier();
      if (cancelled) return;

      const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      w.timestep = 1 / 120;

      // Bed.
      w.createCollider(
        RAPIER.ColliderDesc.cuboid(BED.w / 2, 0.02, BED.d / 2)
          .setTranslation(0, BED.y - 0.02, 0)
          .setFriction(0.35)
          .setRestitution(0.55),
      );

      // Cushion faces.
      const wall = (hx: number, hy: number, hz: number, x: number, y: number, z: number) =>
        w.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz)
            .setTranslation(x, y, z)
            .setFriction(0.2)
            .setRestitution(0.92),
        );

      wall(BED.w / 2, 0.05, 0.02, 0, BED.y + 0.05, BED.d / 2);
      wall(BED.w / 2, 0.05, 0.02, 0, BED.y + 0.05, -BED.d / 2);
      wall(0.02, 0.05, BED.d / 2, BED.w / 2, BED.y + 0.05, 0);
      wall(0.02, 0.05, BED.d / 2, -BED.w / 2, BED.y + 0.05, 0);

      // Bricks, fixed for now: they will become destructible.
      for (const b of bricks) {
        w.createCollider(
          RAPIER.ColliderDesc.cuboid(BRICK.d / 2, BRICK.h / 2, BRICK.w / 2)
            .setTranslation(b.x, BED.y + BRICK.h / 2, b.z)
            .setFriction(0.5)
            .setRestitution(0.45),
        );
      }

      // The handler, so the ball comes back off it.
      w.createCollider(
        RAPIER.ColliderDesc.cuboid(0.035, 0.055, 0.23)
          .setTranslation(HANDLER_X, BED.y + 0.032, 0)
          .setFriction(0.3)
          .setRestitution(0.85),
      );

      const b = w.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(0.42, FELT_TOP + BALL_R, 0.3)
          .setLinearDamping(0.22)
          .setAngularDamping(0.35)
          .setCcdEnabled(true),
      );
      w.createCollider(
        RAPIER.ColliderDesc.ball(BALL_R)
          .setDensity(1.6)
          .setFriction(0.15)
          .setRestitution(0.88),
        b,
      );

      // Launch it up the table toward the wall, with a slight angle.
      b.setLinvel({ x: -3.1, y: 0, z: -0.55 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);

      if (cancelled) {
        w.free();
        return;
      }
      world.current = w;
      body.current = b;
    })();

    return () => {
      cancelled = true;
      world.current?.free();
      world.current = null;
      body.current = null;
    };
  }, [bricks]);

  useFrame((_, delta) => {
    const w = world.current;
    const b = body.current;
    if (!w || !b) return;

    acc.current += Math.min(delta, 0.1);
    let steps = 0;
    while (acc.current >= w.timestep && steps < 8) {
      w.step();
      acc.current -= w.timestep;
      steps += 1;
    }

    const t = b.translation();
    const r = b.rotation();
    if (mesh.current) {
      mesh.current.position.set(t.x, t.y, t.z);
      mesh.current.quaternion.set(r.x, r.y, r.z, r.w);
    }
    if (shadow.current) {
      // The blob sits on the cloth and tracks the ball, spreading as the ball lifts.
      const lift = Math.max(0, t.y - (FELT_TOP + BALL_R));
      const spread = 1 + lift * 0.5;
      shadow.current.position.set(t.x + BALL_R * 0.55, FELT_TOP + 0.002, t.z);
      shadow.current.scale.set(spread, 1, spread);
    }
  });

  const skin = useMemo(() => makeBallTexture(), []);

  // Test hook: where the ball is on screen, so a capture can follow it.
  useEffect(() => {
    (window as unknown as { __ballScreen?: () => { x: number; y: number } | null }).__ballScreen =
      () => {
        const m = mesh.current;
        if (!m) return null;
        const v = m.position.clone().project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((v.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - v.y) / 2) * rect.height,
        };
      };
  }, [camera, gl]);
  const shadowTex = useMemo(() => makeShadowTexture(), []);
  const shadow = useRef<Mesh>(null);

  return (
    <>
      <mesh ref={mesh} position={[0.42, BED.y + BALL_R, 0.3]} castShadow receiveShadow>
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

      {/* Contact shadow as a sibling, so the ball's own transform cannot move it. */}
      <mesh
        ref={shadow}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0.42, BED.y + 0.003, 0.3]}
      >
        <planeGeometry args={[BALL_R * 2.0, BALL_R * 2.0]} />
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

function Table({ bricks }: { bricks: BrickSpec[] }) {
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

      <BrickWall bricks={bricks} />
      <Handler />
      <Ball bricks={bricks} />

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
  const bricks = useMemo(() => brickLayout(), []);

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

        {/* Rim light behind the ball, so its edge separates from the felt. */}
        <pointLight position={[0.2, 1.05, -0.9]} intensity={2.2} distance={3} decay={2} color="#cfe6ff" />

        <Table bricks={bricks} />

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
          ball is live · bricks and handler are static
        </p>
      </div>
    </div>
  );
}
