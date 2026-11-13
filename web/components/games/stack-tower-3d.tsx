"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { Mesh } from "three";

import { DT, JengaSim } from "@/lib/jenga/sim";
import { LAYERS, PLANK, halfExtents, isTopLayer } from "@/lib/jenga/tower";
import { choosePlacement, chooseVerifiedMove, rankMoves } from "@/lib/jenga/policy";
import { makeWoodTextures } from "@/lib/jenga/wood";
import { stackAudio } from "@/lib/stack-tower/audio";

const WOOD_LIGHT = "#ffffff";
const WOOD_DARK = "#d8c2a4";
const HOVER = "#ffd9a0";
const HELD = "#7fd8ff";

/** How far the carried plank may slide from the tower centre. */
const CARRY_LIMIT = 1.15;

/** Each side gets two minutes per turn. Running out loses the turn, and the game. */
const TURN_MS = 120_000;

const THINK_MS = 850;

type Side = "player" | "machine";
type Phase = "pull" | "place" | "over";

interface Scores {
  player: number;
  machine: number;
}

interface MatchState {
  turn: Side;
  phase: Phase;
  loser: Side | null;
  scores: Scores;
  clock: number;
}

interface MatchRef {
  turn: Side;
  phase: Phase;
  loser: Side | null;
  scores: Scores;
  actAt: number;
  deadline: number;
  lastClock: number;
}

interface Held {
  alongX: boolean;
  x: number;
  z: number;
  y: number;
}

function legalPlanks(sim: JengaSim) {
  return sim.planks.filter((p) => {
    if (p.removed || isTopLayer(p.layer)) return false;
    const left = sim.planks.filter((q) => q.layer === p.layer && !q.removed).length;
    return left > 1;
  });
}

/** A safe pull is worth more near the base, where the tower carries more load. */
function pointsFor(layer: number): number {
  return layer < LAYERS / 2 ? 2 : 1;
}

interface PlankProps {
  alongX: boolean;
  color: string;
  material?: THREE.Material;
  emissive?: string;
  opacity?: number;
  position?: [number, number, number];
  scale?: [number, number, number];
  visible?: boolean;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: () => void;
  onMesh?: (mesh: Mesh | null) => void;
}

/** One plank. Props land on the mesh itself so raycasts hit real geometry. */
function Plank({
  alongX,
  color,
  material,
  emissive,
  opacity,
  position,
  scale,
  visible,
  onClick,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onMesh,
}: PlankProps) {
  const size: [number, number, number] = alongX
    ? [PLANK.l, PLANK.h, PLANK.w]
    : [PLANK.w, PLANK.h, PLANK.l];

  return (
    <RoundedBox
      ref={onMesh}
      args={size}
      radius={0.035}
      smoothness={2}
      position={position}
      scale={scale}
      visible={visible}
      castShadow
      receiveShadow
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {material ? (
        <primitive object={material} attach="material" />
      ) : (
        <meshStandardMaterial
          color={color}
          emissive={emissive ?? "#000000"}
          emissiveIntensity={emissive ? 0.45 : 0}
          transparent={opacity !== undefined}
          opacity={opacity ?? 1}
          roughness={0.55}
          metalness={0.02}
        />
      )}
    </RoundedBox>
  );
}

function Scene({
  sim,
  onMatch,
  onCarry,
}: {
  sim: JengaSim;
  onMatch: (s: MatchState) => void;
  onCarry: (busy: boolean) => void;
}) {
  const { camera, raycaster, gl } = useThree();

  const meshes = useRef(new Map<number, Mesh>());
  const acc = useRef(0);
  const wasPulling = useRef(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const match = useRef<MatchRef>({
    turn: "player",
    phase: "pull",
    loser: null,
    scores: { player: 0, machine: 0 },
    actAt: 0,
    deadline: performance.now() + TURN_MS,
    lastClock: Math.ceil(TURN_MS / 1000),
  });

  const heldRef = useRef<Held | null>(null);
  const [, bumpHeld] = useState(0);
  const setHeld = (next: Held | null) => {
    heldRef.current = next;
    bumpHeld((n) => n + 1);
  };

  const carrying = useRef(false);
  const lastValidDrop = useRef(true);
  const pendingAlongX = useRef(true);
  const pullLayer = useRef<number | null>(null);
  const dropPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -3));
  const dropHeld = useRef<(t?: { x: number; z: number; alongX: boolean }) => void>(() => {});

  const textures = useMemo(() => makeWoodTextures(), []);
  const woodLight = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures.map,
        roughnessMap: textures.roughnessMap,
        color: WOOD_LIGHT,
        roughness: 0.62,
        metalness: 0.02,
      }),
    [textures],
  );
  const woodDark = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures.map,
        roughnessMap: textures.roughnessMap,
        color: WOOD_DARK,
        roughness: 0.66,
        metalness: 0.02,
      }),
    [textures],
  );

  const publish = useCallback(() => {
    const m = match.current;
    onMatch({
      turn: m.turn,
      phase: m.phase,
      loser: m.loser,
      scores: { ...m.scores },
      clock: Math.max(0, Math.ceil((m.deadline - performance.now()) / 1000)),
    });
  }, [onMatch]);

  const startTurn = (side: Side) => {
    const m = match.current;
    m.turn = side;
    m.phase = "pull";
    m.deadline = performance.now() + TURN_MS;
    m.lastClock = Math.ceil(TURN_MS / 1000);
    if (side === "machine") m.actAt = performance.now() + THINK_MS;
    publish();
  };

  const finish = (loser: Side) => {
    match.current.phase = "over";
    match.current.loser = loser;
    setHeld(null);
    onCarry(false);
    publish();
  };

  const settleAndJudge = (side: Side): boolean => {
    sim.settle(2.5);
    if (sim.fallen().length > 0) {
      if (!crashPlayed.current) {
        crashPlayed.current = true;
        stackAudio.collapse();
      }
      finish(side);
      return true;
    }
    return false;
  };

  const placementCount = useRef(0);
  /** Set once the crash has sounded, so it is not retriggered every frame. */
  const crashPlayed = useRef(false);
  const beginPlacement = () => {
    placementCount.current += 1;
    const layer = sim.topLayer() + 1;
    const topY = PLANK.h / 2 + layer * PLANK.h;
    dropPlane.current.constant = -topY;
    lastValidDrop.current = true;
    // Carry it at its landing height, so the drop is what you see.
    setHeld({ alongX: pendingAlongX.current, x: 0, z: 0, y: topY });
    match.current.phase = "place";
    publish();
  };

  dropHeld.current = (override) => {
    const h = override ?? heldRef.current;
    if (!h || match.current.phase !== "place") return;
    stackAudio.place(sim.topLayer());
    sim.placeFree(h.x, h.z, h.alongX);
    setHeld(null);
    if (settleAndJudge("player")) return;
    startTurn("machine");
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!carrying.current) return;
      void stackAudio.unlock();
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dropPlane.current, hit)) {
        // Releasing outside the tower returns the plank to the hand instead of
        // snapping it to the edge.
        lastValidDrop.current =
          Math.abs(hit.x) <= CARRY_LIMIT && Math.abs(hit.z) <= CARRY_LIMIT;
        const prev = heldRef.current;
        if (prev) {
          setHeld({
            ...prev,
            x: THREE.MathUtils.clamp(hit.x, -CARRY_LIMIT, CARRY_LIMIT),
            z: THREE.MathUtils.clamp(hit.z, -CARRY_LIMIT, CARRY_LIMIT),
          });
        }
      } else {
        lastValidDrop.current = false;
      }
    };

    const onUp = () => {
      if (!carrying.current) return;
      carrying.current = false;
      onCarry(false);
      if (!lastValidDrop.current) return; // still in hand
      dropHeld.current();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, raycaster, onCarry]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r") return;
      const prev = heldRef.current;
      if (prev) setHeld({ ...prev, alongX: !prev.alongX });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tickMatch = (now: number) => {
    const m = match.current;
    if (m.phase === "over") return;
    if (sim.pulling) return;
    if (m.phase === "place") return;

    if (m.turn === "machine" && now >= m.actAt) {
      const move = chooseVerifiedMove(sim);
      if (!move) {
        finish("machine");
        return;
      }
      const plank = sim.planks.find((p) => p.id === move.plankId);
      pendingAlongX.current = plank ? plank.alongX : true;
      pullLayer.current = move.layer;
      stackAudio.pull();
      sim.beginPull(move.plankId, 1);
    }
  };

  useFrame((_, delta) => {
    const now = performance.now();
    const m = match.current;

    acc.current += Math.min(delta, 0.1);
    let steps = 0;
    while (acc.current >= DT && steps < 8) {
      sim.step();
      acc.current -= DT;
      steps += 1;
    }

    const transforms = sim.transforms();
    for (const t of transforms) {
      const mesh = meshes.current.get(t.id);
      if (!mesh) continue;
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(t.qx, t.qy, t.qz, t.qw);
    }

    // Any plank that has dropped out of its layer counts: one or two coming off the top
    // should be heard, even though only a real collapse ends the match.
    if (!crashPlayed.current && !sim.pulling && match.current.phase !== "over") {
      const heights = new Map(transforms.map((tr) => [tr.id, tr.y]));
      for (const plank of sim.planks) {
        if (plank.removed) continue;
        const y = heights.get(plank.id);
        if (y === undefined) continue;
        const nominal = PLANK.h / 2 + plank.layer * PLANK.h;
        if (y < nominal - 0.12) {
          crashPlayed.current = true;
          stackAudio.collapse();
          break;
        }
      }
    }

    if (m.phase !== "over") {
      const secs = Math.max(0, Math.ceil((m.deadline - now) / 1000));
      if (secs !== m.lastClock) {
        m.lastClock = secs;
        publish();
      }
      if (secs <= 0) {
        finish(m.turn);
        return;
      }
    }

    if (wasPulling.current && !sim.pulling) {
      wasPulling.current = false;

      if (settleAndJudge(m.turn)) return;

      // Points land only after the extraction is judged safe.
      if (pullLayer.current !== null) {
        m.scores[m.turn] += pointsFor(pullLayer.current);
        pullLayer.current = null;
      }

      if (m.turn === "player") {
        beginPlacement();
      } else {
        const opts = sim.placementOptions();
        if (opts.length === 0) {
          finish("machine");
          return;
        }
        stackAudio.place(sim.topLayer());
        sim.place(choosePlacement(sim, opts));
        if (settleAndJudge("machine")) return;
        startTurn("player");
      }
      return;
    }
    if (sim.pulling) wasPulling.current = true;

    tickMatch(now);
  });


  const canPull = (layer: number) => {
    const m = match.current;
    if (m.phase !== "pull" || m.turn !== "player") return false;
    if (isTopLayer(layer)) return false;
    const left = sim.planks.filter((p) => p.layer === layer && !p.removed).length;
    return left > 1 && !sim.pulling;
  };

  const onPull = (id: number, layer: number, alongX: boolean) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!canPull(layer)) return;
    void stackAudio.unlock();
    pendingAlongX.current = alongX;
    pullLayer.current = layer;
    stackAudio.pull();
    sim.beginPull(id, 1);
  };

  // Test hook: same code paths as input, without a pointer.
  const debug = useRef({
    state: () => ({
      turn: "player" as Side,
      phase: "pull" as Phase,
      loser: null as Side | null,
      scores: { player: 0, machine: 0 },
    }),
    drop: (_x: number, _z: number, _alongX: boolean) => {},
    heldScreen: () => null as { x: number; y: number } | null,
    plankScreen: (_id: number) => null as { x: number; y: number } | null,
  });
  debug.current.state = () => ({
    turn: match.current.turn,
    phase: match.current.phase,
    loser: match.current.loser,
    scores: { ...match.current.scores },
  });
  debug.current.drop = (x, z, alongX) => dropHeld.current({ x, z, alongX });
  debug.current.plankScreen = (id: number) => {
    const pose = sim.pose(id);
    if (!pose) return null;
    const v = new THREE.Vector3(pose.x, pose.y, pose.z).project(camera);
    const rect = gl.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  };
  debug.current.heldScreen = () => {
    const h = heldRef.current;
    if (!h) return null;
    const v = new THREE.Vector3(h.x, h.y, h.z).project(camera);
    const rect = gl.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  };
  useEffect(() => {
    (window as unknown as { __game?: typeof debug.current }).__game = debug.current;
    (window as unknown as { __stackSound?: () => unknown }).__stackSound = () => stackAudio.report;
    (window as unknown as { __stackPlay?: (k: string) => void }).__stackPlay = (k) => {
      if (k === "pull") stackAudio.pull();
      if (k === "place") stackAudio.place(4);
      if (k === "collapse") stackAudio.collapse();
    };
    (window as unknown as { __stackUnlock?: () => void }).__stackUnlock = () => void stackAudio.unlock();
  }, []);

  const held = heldRef.current;

  return (
    <group>
      {sim.planks.map((p) => {
        const selectable = canPull(p.layer);
        return (
          <Plank
            key={p.id}
            alongX={p.alongX}
            position={[p.x, p.y, p.z]}
            visible={!p.removed}
            material={hovered === p.id ? undefined : p.alongX ? woodLight : woodDark}
            color={hovered === p.id ? HOVER : WOOD_LIGHT}
            onMesh={(mesh) => {
              if (mesh) meshes.current.set(p.id, mesh);
              else meshes.current.delete(p.id);
            }}
            onClick={onPull(p.id, p.layer, p.alongX)}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (selectable) setHovered(p.id);
            }}
            onPointerOut={() => setHovered(null)}
          />
        );
      })}

      {held ? (
        <Plank
          alongX={held.alongX}
          position={[held.x, held.y, held.z]}
          scale={[1.15, 1.8, 1.15]}
          color={HELD}
          emissive={HELD}
          opacity={0.75}
          onPointerDown={(event) => {
            event.stopPropagation();
            carrying.current = true;
            onCarry(true);
          }}
        />
      ) : null}
    </group>
  );
}

const EMPTY_MATCH: MatchState = {
  turn: "player",
  phase: "pull",
  loser: null,
  scores: { player: 0, machine: 0 },
  clock: TURN_MS / 1000,
};

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function StackTowerGame() {
  const [sim, setSim] = useState<JengaSim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchState>(EMPTY_MATCH);
  const [carryUi, setCarryUi] = useState(false);
  const [generation, setGeneration] = useState(0);

  const load = useCallback(async () => {
    try {
      const s = await JengaSim.create();
      s.settle(3.0);
      (window as unknown as { __jenga?: JengaSim }).__jenga = s;
      setSim(s);
      setMatch(EMPTY_MATCH);
      setGeneration((g) => g + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "physics failed to start");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const camera = useMemo(
    () => ({ position: [13, 11, 13] as [number, number, number], fov: 42 }),
    [],
  );

  const over = match.phase === "over";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#070708]">
      {sim && (
        <Canvas
          key={generation}
          shadows="percentage"
          camera={camera}
          dpr={[1, 2]}
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
          <color attach="background" args={["#070708"]} />
          <fog attach="fog" args={["#070708", 24, 54]} />

          <ambientLight intensity={0.32} />
          <directionalLight
            position={[7, 15, 9]}
            intensity={2.6}
            color="#fff1d6"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
          />
          <directionalLight position={[-9, 7, -6]} intensity={0.5} color="#8fb4d8" />
          <pointLight position={[0, 4, -12]} intensity={40} color="#ffcf9a" />

          <Scene sim={sim} onMatch={setMatch} onCarry={setCarryUi} />

          {/* Studio floor: dark, with the tower's contact shadow. */}
          <mesh position={[0, -0.26, 0]} receiveShadow>
            <boxGeometry args={[40, 0.5, 40]} />
            <meshStandardMaterial color="#0d0d10" roughness={0.92} metalness={0.05} />
          </mesh>
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.55}
            scale={22}
            blur={2.6}
            far={7}
            resolution={512}
            color="#000000"
          />

          <OrbitControls
            target={[0, (LAYERS * PLANK.h) / 2 + 1.2, 0]}
            enablePan={false}
            minDistance={9}
            maxDistance={30}
            maxPolarAngle={Math.PI / 2.05}
            enabled={!carryUi}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
          />
        </Canvas>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <a
              href="/"
              className="pointer-events-auto font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-white"
            >
              ← Hall
            </a>
            <p className="font-display mt-3 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              You
            </p>
            <p className="font-heading text-lg text-[#ffd9a0]">{match.scores.player}</p>
          </div>

          <div className="text-right">
            <p className="font-display text-[10px] uppercase tracking-[0.18em] text-zinc-600">
              Machine
            </p>
            <p className="font-heading text-lg text-[#9ec9ff]">{match.scores.machine}</p>
            <p className="font-display mt-2 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              {sim ? `${sim.planks.filter((p) => !p.removed).length} planks` : "loading"}
            </p>
          </div>
        </div>

        <div className="mx-auto rounded-sm bg-black/60 px-5 py-3 text-center backdrop-blur-sm">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-zinc-200">
            {over
              ? match.loser === "player"
                ? "the tower fell on your move"
                : "the tower fell on the machine's move"
              : match.turn === "player"
                ? match.phase === "place"
                  ? "carry the plank onto the tower"
                  : "your turn · pull a plank"
                : "machine is thinking"}
          </p>
          <p className="font-display mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
            {over ? "game over" : formatClock(match.clock)}
          </p>
          <p className="font-display mt-2 text-[9px] uppercase tracking-[0.14em] text-zinc-600">
            {over
              ? match.loser === "player"
                ? "you lose"
                : "you win"
              : match.phase === "place"
                ? "press the plank · move · release to drop · R to rotate · drag to orbit"
                : "click a plank to pull · drag to orbit · the top layer is locked"}
          </p>

          {over && (
            <button
              onClick={() => void load()}
              className="pointer-events-auto arcade-btn mt-4 px-6 text-[11px]"
            >
              Play again
            </button>
          )}

          {!sim && !error && (
            <p className="font-display mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              building the tower
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
