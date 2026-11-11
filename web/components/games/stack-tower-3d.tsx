"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Group, Mesh, PerspectiveCamera } from "three";

import { dateKey } from "@/lib/puzzles/date";
import {
  BASE_W,
  BLOCK_H,
  FIELD_H,
  FIELD_W,
  MILESTONE,
  resolvePlacement,
  stackSpecsForDay,
  type BlockSpec,
  type StackKind,
} from "@/lib/games/stack-tower";

const BLOCK_DEPTH = 0.5;

/** Radians the board leans back. Positive tips the top away from the viewer. */
const BOARD_PITCH = 0.18;
const BEST_KEY = "imarket:stack-tower:best";

const KIND_COLOR: Record<StackKind, string> = {
  normal: "#38bdf8",
  gold: "#fbbf24",
  bomb: "#fb7185",
  stone: "#94a3b8",
};

interface Placed extends StackLike {
  kind: StackKind;
  y: number;
}

interface StackLike {
  x: number;
  w: number;
}

interface Sim {
  specs: BlockSpec[];
  index: number;
  blocks: Placed[];
  current: { x: number; w: number; dir: 1 | -1; speed: number; kind: StackKind; y: number };
  combo: number;
  streak: number;
  acc: number;
  over: boolean;
}

function createSim(specs: BlockSpec[]): Sim {
  const y = -FIELD_H / 2 + BLOCK_H / 2;
  const first: Placed = { x: -BASE_W / 2, w: BASE_W, y, kind: "normal" };
  const spec = specs[0];
  return {
    specs,
    index: 1,
    blocks: [first],
    current: {
      x: -FIELD_W / 2 + BASE_W / 2,
      w: BASE_W,
      dir: spec.dir,
      speed: spec.speed,
      kind: spec.kind,
      y: y + BLOCK_H,
    },
    combo: 1,
    streak: 0,
    acc: 0,
    over: false,
  };
}

/** Advances the sliding block on a fixed 1/60 step so speed never depends on frame rate. */
function SimRunner({ sim }: { sim: Sim }) {
  const mesh = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (sim.over) return;

    sim.acc += Math.min(delta, 0.1);
    const step = 1 / 60;
    while (sim.acc >= step) {
      sim.acc -= step;
      const c = sim.current;
      const min = -FIELD_W / 2;
      const max = FIELD_W / 2 - c.w;

      c.x += c.dir * (c.speed / 60) * step;
      if (c.x <= min) {
        c.x = min;
        c.dir = 1;
      } else if (c.x >= max) {
        c.x = max;
        c.dir = -1;
      }
    }

    if (mesh.current) {
      mesh.current.position.x = sim.current.x + sim.current.w / 2;
    }
  });

  return (
    <mesh
      ref={mesh}
      position={[sim.current.x + sim.current.w / 2, sim.current.y, 0]}
      scale={[sim.current.w, BLOCK_H * 0.94, BLOCK_DEPTH]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={KIND_COLOR[sim.current.kind]}
        emissive={KIND_COLOR[sim.current.kind]}
        emissiveIntensity={0.25}
        roughness={0.35}
        metalness={0.15}
      />
    </mesh>
  );
}

/**
 * Long-lens perspective, level and centred. The convergence here is what makes the
 * tilted board read as receding; a wide lens would overdo it and bend the cabinet.
 */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const c = camera as PerspectiveCamera;
    const vFov = (c.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(1, size.height);
    const distV = 6.9 / Math.tan(vFov / 2);
    const distH = 4.9 / (Math.tan(vFov / 2) * aspect);
    c.position.set(0, 0, Math.max(distV, distH));
    c.lookAt(0, 0, 0);
    c.updateProjectionMatrix();
  }, [camera, size.height, size.width]);
  return null;
}

function Cabinet() {
  const { scene } = useGLTF("/models/stack_frame.glb");
  return <primitive object={scene} />;
}

function Blocks({ blocks }: { blocks: Placed[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x + b.w / 2, b.y, 0]}>
          <boxGeometry args={[b.w, BLOCK_H * 0.94, BLOCK_DEPTH]} />
          <meshStandardMaterial
            color={KIND_COLOR[b.kind]}
            emissive={KIND_COLOR[b.kind]}
            emissiveIntensity={b.kind === "normal" ? 0.12 : 0.3}
            roughness={0.38}
            metalness={0.15}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Board markings. Without lines the tilted plane is a flat black rectangle and the
 * perspective has nothing to converge, so the tilt reads as nothing at all.
 */
function BoardGrid() {
  const lines: React.ReactElement[] = [];
  const halfW = FIELD_W / 2;
  const halfH = FIELD_H / 2;

  for (let y = -halfH; y <= halfH + 0.001; y += 0.75) {
    lines.push(
      <mesh key={`h${y.toFixed(2)}`} position={[0, y, 0.002]}>
        <planeGeometry args={[FIELD_W, 0.012]} />
        <meshBasicMaterial color={Math.abs(y) < 0.01 ? "#2f7fb4" : "#173f5c"} />
      </mesh>,
    );
  }
  for (let x = -halfW; x <= halfW + 0.001; x += 0.75) {
    lines.push(
      <mesh key={`v${x.toFixed(2)}`} position={[x, 0, 0.002]}>
        <planeGeometry args={[0.012, FIELD_H]} />
        <meshBasicMaterial color={Math.abs(x) < 0.01 ? "#2f7fb4" : "#173f5c"} />
      </mesh>,
    );
  }

  return <>{lines}</>;
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  // A slight yaw so the cabinet reads as a solid object, not a poster.
  return (
    <group ref={group} rotation={[0, -0.18, 0]} position={[0, 0, 0]}>
      {children}
    </group>
  );
}

function Scene({ sim, blocks }: { sim: Sim; blocks: Placed[] }) {
  return (
    <>
      <FitCamera />
      <color attach="background" args={["#05060a"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[-6, 8, 10]} intensity={1.6} color="#cfe6ff" />
      <directionalLight position={[8, -4, 6]} intensity={0.7} color="#8b5cf6" />
      <pointLight position={[0, 0, 6]} intensity={18} distance={18} color="#22e0ff" />

      <Rig>
        <Cabinet />

        {/* The board is tilted back inside the upright cabinet, like a screen set at
            an angle: its top edge sits farther from the viewer than its bottom. */}
        <group rotation={[-BOARD_PITCH, 0, 0]} position={[0, 0, -0.55]}>
          <mesh position={[0, 0, -0.15]}>
            <planeGeometry args={[FIELD_W * 1.12, FIELD_H * 1.34]} />
            <meshStandardMaterial
              color="#0c1a2a"
              emissive="#0a1c30"
              emissiveIntensity={0.55}
              roughness={0.9}
              metalness={0.05}
            />
          </mesh>

          <BoardGrid />
          <Blocks blocks={blocks} />
          <SimRunner sim={sim} />
        </group>
      </Rig>
    </>
  );
}

export function StackTowerGame() {
  const day = useMemo(() => dateKey(), []);
  const specs = useMemo(() => stackSpecsForDay(day), [day]);

  const sim = useRef<Sim>(createSim(specs));
  const [blocks, setBlocks] = useState<Placed[]>(sim.current.blocks);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);
  const [perfectFlash, setPerfectFlash] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    const v = Number(window.localStorage.getItem(BEST_KEY) || 0);
    setBest(v > 0 ? v : null);
  }, []);

  const restart = useCallback(() => {
    sim.current = createSim(specs);
    setBlocks(sim.current.blocks);
    setScore(0);
    setCombo(1);
    setStreak(0);
    setOver(false);
    setMilestone(null);
  }, [specs]);

  const drop = useCallback(() => {
    const s = sim.current;
    if (s.over) return;

    const top = s.blocks[s.blocks.length - 1];
    const result = resolvePlacement(top, s.current, s.current.kind, s.combo, s.streak);

    if (!result.block) {
      s.over = true;
      setOver(true);
      setScore((prev) => {
        const next = prev + 0;
        if (next > (best ?? 0)) {
          window.localStorage.setItem(BEST_KEY, String(next));
          setBest(next);
        }
        return next;
      });
      return;
    }

    const placed: Placed = {
      x: result.block.x,
      w: result.block.w,
      y: top.y + BLOCK_H,
      kind: s.current.kind,
    };
    s.blocks.push(placed);
    s.combo = result.combo;
    s.streak = result.streak;

    const nextScore = score + result.gained;
    s.index = Math.min(s.index + 1, s.specs.length - 1);
    const spec = s.specs[s.index];
    s.current = {
      x: -FIELD_W / 2 + placed.w / 2,
      w: placed.w,
      dir: spec.dir,
      speed: spec.speed,
      kind: spec.kind,
      y: placed.y + BLOCK_H,
    };

    setBlocks([...s.blocks]);
    setScore(nextScore);
    setCombo(result.combo);
    setStreak(result.streak);
    if (result.perfect) setPerfectFlash((n) => n + 1);

    if (s.blocks.length % MILESTONE === 0) {
      setMilestone(s.blocks.length);
      window.setTimeout(() => setMilestone(null), 1600);
    }
    if (nextScore > (best ?? 0)) {
      window.localStorage.setItem(BEST_KEY, String(nextScore));
      setBest(nextScore);
    }
  }, [best, score]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        drop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drop]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#05060a]">
      <Canvas
        camera={{ position: [0, 0, 52], fov: 17, near: 1, far: 200 }}
        dpr={[1, 2]}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <Scene sim={sim.current} blocks={blocks} />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <a
            href="/"
            className="pointer-events-auto font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-white"
          >
            ← Hall
          </a>
          <div className="text-right">
            <p className="font-display text-[10px] uppercase tracking-[0.18em] text-zinc-600">
              Score
            </p>
            <p className="font-heading text-lg text-white">{score}</p>
            <p className="font-display mt-1 text-[9px] uppercase tracking-[0.14em] text-zinc-600">
              Best {best ?? 0}
            </p>
          </div>
        </div>

        {combo > 1 && (
          <div className="self-start rounded-sm border border-emerald-400/50 bg-emerald-500/10 px-2.5 py-1">
            <span className="font-display text-[11px] text-emerald-300">×{combo}</span>
            <span className="font-display ml-2 text-[9px] uppercase tracking-[0.14em] text-emerald-500/80">
              {streak} perfect
            </span>
          </div>
        )}

        <div className="text-center">
          {milestone && (
            <p className="font-heading mb-2 text-sm text-[#22e0ff]">FLOOR {milestone}</p>
          )}
          <button
            onClick={drop}
            className="pointer-events-auto arcade-btn font-display text-[11px] uppercase tracking-[0.16em]"
          >
            Drop
          </button>
          <p className="font-display mt-2 text-[9px] uppercase tracking-[0.16em] text-zinc-600">
            Space or tap · perfect keeps your width
          </p>
        </div>
      </div>

      {perfectFlash > 0 && (
        <span key={perfectFlash} className="pointer-events-none absolute inset-0" aria-hidden />
      )}

      {over && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="pixel-panel rounded-sm p-8 text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              The tower fell
            </p>
            <p className="font-heading mt-3 text-xl text-white">{score}</p>
            <p className="font-display mt-1 text-[9px] uppercase tracking-[0.16em] text-zinc-600">
              Best {best ?? score}
            </p>
            <button onClick={restart} className="arcade-btn mt-6 px-6">
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

useGLTF.preload("/models/stack_frame.glb");
