"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Mesh } from "three";

import { DT, JengaSim } from "@/lib/jenga/sim";
import { LAYERS, PLANK, halfExtents, isTopLayer } from "@/lib/jenga/tower";
import { choosePlacement, chooseVerifiedMove, rankMoves } from "@/lib/jenga/policy";

const WOOD = "#d8a45e";
const WOOD_DARK = "#a9762f";
const HOVER = "#f2c98a";
const HELD = "#7fd8ff";

/** How far the carried plank may slide from the tower centre. */
const CARRY_LIMIT = 1.15;

type Side = "player" | "machine";
type Phase = "pull" | "place" | "over";

interface MatchState {
  turn: Side;
  phase: Phase;
  loser: Side | null;
}

const THINK_MS = 850;

interface MatchRef {
  turn: Side;
  phase: Phase;
  loser: Side | null;
  actAt: number;
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

function Scene({ sim, onMatch, onCarry }: { sim: JengaSim; onMatch: (s: MatchState) => void; onCarry: (busy: boolean) => void }) {
  const { camera, raycaster, gl } = useThree();

  const meshes = useRef(new Map<number, Mesh>());
  const acc = useRef(0);
  const wasPulling = useRef(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const match = useRef<MatchRef>({ turn: "player", phase: "pull", loser: null, actAt: 0 });

  // The carried plank lives in a ref with an explicit re-render. Keeping it in React
  // state alone let the update be dropped between frames, so the plank never appeared.
  const heldRef = useRef<Held | null>(null);
  const [, bumpHeld] = useState(0);
  const setHeld = (next: Held | null) => {
    heldRef.current = next;
    bumpHeld((n) => n + 1);
  };

  const carrying = useRef(false);
  const pendingAlongX = useRef(true);
  const dropPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -3));
  const dropHeld = useRef<(t?: { x: number; z: number; alongX: boolean }) => void>(() => {});

  const publish = useCallback(() => {
    onMatch({ turn: match.current.turn, phase: match.current.phase, loser: match.current.loser });
  }, [onMatch]);

  const finish = (loser: Side) => {
    match.current.phase = "over";
    match.current.loser = loser;
    setHeld(null);
    publish();
  };

  /**
   * Option 3 of the collapse rule: settle until the tower is genuinely still, then
   * judge. A slow collapse is charged to the move that caused it.
   */
  const settleAndJudge = (side: Side): boolean => {
    sim.settle(2.5);
    if (sim.fallen().length > 0) {
      finish(side);
      return true;
    }
    return false;
  };

  const placementCount = useRef(0);
  const beginPlacement = () => {
    placementCount.current += 1;
    const layer = sim.topLayer() + 1;
    const topY = PLANK.h / 2 + layer * PLANK.h;
    dropPlane.current.constant = -topY;
    // Carry it at its landing height, so the drop is what you see.
    setHeld({ alongX: pendingAlongX.current, x: 0, z: 0, y: topY });
    match.current.phase = "place";
    publish();
  };

  dropHeld.current = (override) => {
    const h = override ?? heldRef.current;
    if (!h || match.current.phase !== "place") return;
    sim.placeFree(h.x, h.z, h.alongX);
    setHeld(null);
    if (settleAndJudge("player")) return;
    match.current.turn = "machine";
    match.current.phase = "pull";
    match.current.actAt = performance.now() + THINK_MS;
    publish();
  };

  // Pointer: while carrying, the plank follows the cursor on the drop plane.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!carrying.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dropPlane.current, hit)) {
        const prev = heldRef.current;
        if (prev) {
          setHeld({
            ...prev,
            x: THREE.MathUtils.clamp(hit.x, -CARRY_LIMIT, CARRY_LIMIT),
            z: THREE.MathUtils.clamp(hit.z, -CARRY_LIMIT, CARRY_LIMIT),
          });
        }
      }
    };

    const onUp = () => {
      if (!carrying.current) return;
      carrying.current = false;
      onCarry(false);
      dropHeld.current();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, raycaster]);

  // R rotates the carried plank.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r") return;
      const prev = heldRef.current;
      if (prev) setHeld({ ...prev, alongX: !prev.alongX });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Test hook: the same drop path as a pointer release, callable without a mouse.
  const debug = useRef({
    state: () => ({ turn: "player" as Side, phase: "pull" as Phase, loser: null as Side | null }),
    drop: (_x: number, _z: number, _alongX: boolean) => {},
    rank: () => [] as unknown,
    heldScreen: () => null as { x: number; y: number } | null,
    heldRaw: () => ({} as unknown),
    cameraPos: () => [] as number[],
  });
  debug.current.state = () => ({
    turn: match.current.turn,
    phase: match.current.phase,
    loser: match.current.loser,
  });
  debug.current.drop = (x, z, alongX) => dropHeld.current({ x, z, alongX });
  debug.current.rank = () => rankMoves(sim, 3);
  debug.current.heldRaw = () => ({ held: heldRef.current, placements: placementCount.current, phase: match.current.phase });
  debug.current.cameraPos = () => camera.position.toArray().map((v) => Number(v.toFixed(3)));
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
      pendingAlongX.current = move.plankId % 2 === 0;
      const plank = sim.planks.find((p) => p.id === move.plankId);
      pendingAlongX.current = plank ? plank.alongX : true;
      sim.beginPull(move.plankId, 1);
    }
  };

  useFrame((_, delta) => {
    const now = performance.now();

    acc.current += Math.min(delta, 0.1);
    let steps = 0;
    while (acc.current >= DT && steps < 8) {
      sim.step();
      acc.current -= DT;
      steps += 1;
    }

    for (const t of sim.transforms()) {
      const mesh = meshes.current.get(t.id);
      if (!mesh) continue;
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(t.qx, t.qy, t.qz, t.qw);
    }

    const m = match.current;

    if (wasPulling.current && !sim.pulling) {
      wasPulling.current = false;

      if (settleAndJudge(m.turn)) return;

      if (m.turn === "player") {
        beginPlacement();
      } else {
        const opts = sim.placementOptions();
        if (opts.length === 0) {
          finish("machine");
          return;
        }
        sim.place(choosePlacement(sim, opts));
        if (settleAndJudge("machine")) return;
        m.turn = "player";
        m.phase = "pull";
        publish();
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
    pendingAlongX.current = alongX;
    sim.beginPull(id, 1);
  };

  const held = heldRef.current;
  const heldHe = held ? halfExtents(held.alongX) : null;

  return (
    <group>
      {sim.planks.map((p) => {
        const he = halfExtents(p.alongX);
        const selectable = canPull(p.layer);
        return (
          <mesh
            key={p.id}
            ref={(mesh) => {
              if (mesh) meshes.current.set(p.id, mesh);
              else meshes.current.delete(p.id);
            }}
            position={[p.x, p.y, p.z]}
            visible={!p.removed}
            castShadow
            receiveShadow
            onClick={onPull(p.id, p.layer, p.alongX)}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (selectable) setHovered(p.id);
            }}
            onPointerOut={() => setHovered(null)}
          >
            <boxGeometry args={[he.x * 2, he.y * 2, he.z * 2]} />
            <meshStandardMaterial
              color={
                !selectable ? "#6b5233" : hovered === p.id ? HOVER : p.alongX ? WOOD : WOOD_DARK
              }
              roughness={0.62}
              metalness={0.02}
            />
          </mesh>
        );
      })}

      {/* The plank in hand: press it to carry, release to drop. */}
      {held && heldHe ? (
        <mesh
          position={[held.x, held.y, held.z]}
          rotation={[0, held.alongX ? 0 : Math.PI / 2, 0]}
          onPointerDown={(event) => {
            event.stopPropagation();
            carrying.current = true;
            onCarry(true);
          }}
        >
          <boxGeometry args={[PLANK.l * 1.25, PLANK.h * 2.2, PLANK.w * 1.25]} />
          <meshStandardMaterial
            color={HELD}
            emissive="#2aa6d6"
            emissiveIntensity={0.5}
            transparent
            opacity={0.85}
            roughness={0.4}
          />
        </mesh>
      ) : null}

      {/* Where it will land. */}
      {held ? (
        <mesh position={[held.x, PLANK.h / 2 + (sim.topLayer() + 1) * PLANK.h - 0.28, held.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PLANK.l, PLANK.w]} />
          <meshBasicMaterial color={HELD} transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

export function StackTowerGame() {
  const [sim, setSim] = useState<JengaSim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchState>({ turn: "player", phase: "pull", loser: null });
  const [carryUi, setCarryUi] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await JengaSim.create();
        s.settle(3.0);
        if (cancelled) return;
        (window as unknown as { __jenga?: JengaSim }).__jenga = s;
        setSim(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "physics failed to start");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const camera = useMemo(
    () => ({ position: [13, 11, 13] as [number, number, number], fov: 42 }),
    [],
  );

  const over = match.phase === "over";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0b0b0d]">
      {sim && (
        <Canvas shadows camera={camera} dpr={[1, 2]}>
          <color attach="background" args={["#0b0b0d"]} />
          <fog attach="fog" args={["#0b0b0d", 26, 52]} />

          <ambientLight intensity={0.55} />
          <directionalLight
            position={[8, 14, 6]}
            intensity={2.1}
            color="#fff2dd"
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <directionalLight position={[-9, 6, -7]} intensity={0.45} color="#9fb6d4" />

          <Scene sim={sim} onMatch={setMatch} onCarry={setCarryUi} />

          <mesh position={[0, -0.26, 0]} receiveShadow>
            <boxGeometry args={[26, 0.5, 26]} />
            <meshStandardMaterial color="#141416" roughness={0.9} />
          </mesh>

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
          <a
            href="/"
            className="pointer-events-auto font-display text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-white"
          >
            ← Hall
          </a>
          <div className="text-right">
            <p className="font-display text-[10px] uppercase tracking-[0.18em] text-zinc-600">
              Stack Tower
            </p>
            <p className="font-display mt-1 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              {sim ? `${sim.planks.filter((p) => !p.removed).length} planks` : "loading"}
            </p>
          </div>
        </div>

        <div className="text-center">
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
          <p className="font-display mt-2 text-[9px] uppercase tracking-[0.14em] text-zinc-600">
            {over
              ? match.loser === "player"
                ? "you lose"
                : "you win"
              : match.phase === "place"
                ? "press the plank · move · release to drop · R to rotate · drag empty space to orbit"
                : "click a plank to pull it · drag to orbit · the top layer is locked"}
          </p>
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
