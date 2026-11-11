"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";

import { DT, JengaSim, type Placement } from "@/lib/jenga/sim";
import { LAYERS, PLANK, halfExtents, isTopLayer } from "@/lib/jenga/tower";
import { choosePlacement, chooseVerifiedMove, rankMoves } from "@/lib/jenga/policy";

const WOOD = "#d8a45e";
const WOOD_DARK = "#a9762f";
const HOVER = "#f2c98a";

type Side = "player" | "machine";
type Phase = "pull" | "place" | "over";

interface MatchState {
  turn: Side;
  phase: Phase;
  loser: Side | null;
}

const THINK_MS = 850;
const PLACE_PAUSE_MS = 320;

interface MatchRef {
  turn: Side;
  phase: Phase;
  loser: Side | null;
  options: Placement[] | null;
  /** Timestamp (ms) at which the machine is allowed to act. */
  actAt: number;
}

function legalPlanks(sim: JengaSim) {
  return sim.planks.filter((p) => {
    if (p.removed || isTopLayer(p.layer)) return false;
    const left = sim.planks.filter((q) => q.layer === p.layer && !q.removed).length;
    return left > 1;
  });
}

function Scene({
  sim,
  onMatch,
}: {
  sim: JengaSim;
  onMatch: (state: MatchState) => void;
}) {
  const meshes = useRef(new Map<number, Mesh>());
  const acc = useRef(0);
  const wasPulling = useRef(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const match = useRef<MatchRef>({
    turn: "player",
    phase: "pull",
    loser: null,
    options: null,
    actAt: 0,
  });

  const publish = useCallback(() => {
    onMatch({ turn: match.current.turn, phase: match.current.phase, loser: match.current.loser });
  }, [onMatch]);

  /**
   * Option 3 of the collapse rule: let the tower settle completely before judging, so
   * a slow collapse lands on the move that caused it instead of the next player's turn.
   */
  const settleAndJudge = (side: Side): boolean => {
    sim.settle(2.5);
    if (sim.fallen().length > 0) {
      finish(side);
      return true;
    }
    return false;
  };

  const finish = (loser: Side) => {
    match.current.phase = "over";
    match.current.loser = loser;
    match.current.options = null;
    publish();
  };

  /** Runs one turn-boundary decision. Called every frame, cheap when nothing is due. */
  const tickMatch = (now: number) => {
    const m = match.current;
    if (m.phase === "over") return;
    // Never decide while a pull is animating: the decision costs eight physics probes,
    // so running it per frame stalls the whole scene.
    if (sim.pulling) return;

    if (m.phase === "place") {
      // Player is choosing; nothing to do until they click.
      return;
    }

    if (m.turn === "machine" && m.phase === "pull" && now >= m.actAt) {
      const legal = legalPlanks(sim);
      if (legal.length === 0) {
        finish("machine");
        return;
      }
      // The opponent is the math model in lib/jenga/policy.ts: geometry and mass,
      // no learning, no randomness.
      const move = chooseVerifiedMove(sim);
      if (!move) {
        finish("machine");
        return;
      }
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

    // A pull just ended: judge the tower, then either ask the player where to place,
    // or let the machine place on its own.
    if (wasPulling.current && !sim.pulling) {
      wasPulling.current = false;

      if (settleAndJudge(m.turn)) return;

      if (m.turn === "player") {
        m.options = sim.placementOptions();
        m.phase = "place";
        publish();
      } else {
        const opts = sim.placementOptions();
        if (opts.length === 0) {
          finish("machine");
          return;
        }
        const chosen = choosePlacement(sim, opts);
        sim.place(chosen);
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

  const onPull = (id: number, layer: number) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!canPull(layer)) return;
    sim.beginPull(id, 1);
  };

  const placeOption = (opt: Placement) => {
    const m = match.current;
    if (m.phase !== "place") return;
    sim.place(opt);
    if (settleAndJudge("player")) return;
    m.options = null;
    m.turn = "machine";
    m.phase = "pull";
    m.actAt = performance.now() + THINK_MS;
    publish();
  };

  const onPlace = (opt: Placement) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    placeOption(opt);
  };

  // Test hook: same code path as a click, without a pointer.
  const debugApi = useRef({
    place: (_index: number) => {},
    state: () => ({ turn: "player" as Side, phase: "pull" as Phase, loser: null as Side | null }),
    rank: () => [] as unknown,
  });
  debugApi.current.place = (index: number) => {
    const opt = match.current.options?.[index];
    if (opt) placeOption(opt);
  };
  debugApi.current.rank = () => rankMoves(sim, 5);
  debugApi.current.state = () => ({
    turn: match.current.turn,
    phase: match.current.phase,
    loser: match.current.loser,
  });
  useEffect(() => {
    (window as unknown as { __game?: typeof debugApi.current }).__game = debugApi.current;
  }, []);

  return (
    <group>
      {sim.planks.map((p) => {
        const he = halfExtents(p.alongX);
        const selectable = canPull(p.layer) && !sim.planks.find((q) => q.id === p.id)?.removed;
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
            onClick={onPull(p.id, p.layer)}
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

      {match.current.options && match.current.phase === "place"
        ? match.current.options.map((o) => {
            const he = halfExtents(o.alongX);
            return (
              <mesh
                key={`${o.layer}-${o.alongX}-${o.slot}`}
                position={[o.x, o.y + 0.05, o.z]}
                onClick={onPlace(o)}
                onPointerOver={(e) => e.stopPropagation()}
              >
                <boxGeometry args={[he.x * 2, he.y * 2, he.z * 2]} />
                <meshStandardMaterial
                  color="#7fd8ff"
                  emissive="#2aa6d6"
                  emissiveIntensity={0.7}
                  transparent
                  opacity={0.3}
                  wireframe
                />
              </mesh>
            );
          })
        : null}
    </group>
  );
}

export function StackTowerGame() {
  const [sim, setSim] = useState<JengaSim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchState>({ turn: "player", phase: "pull", loser: null });

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

          <Scene sim={sim} onMatch={setMatch} />

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
                ? "the tower fell on your turn"
                : "the tower fell on the machine's turn"
              : match.turn === "player"
                ? match.phase === "place"
                  ? "your turn · choose where it goes"
                  : "your turn · pull a plank"
                : "machine is thinking"}
          </p>
          <p className="font-display mt-2 text-[9px] uppercase tracking-[0.14em] text-zinc-600">
            {over
              ? match.loser === "player"
                ? "you lose"
                : "you win"
              : "drag to orbit · the top layer is locked"}
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
