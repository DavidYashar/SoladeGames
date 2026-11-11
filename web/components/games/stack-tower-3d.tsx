"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";

import { DT, JengaSim, type Placement } from "@/lib/jenga/sim";
import { LAYERS, PLANK, halfExtents, isTopLayer } from "@/lib/jenga/tower";

const WOOD = "#d8a45e";
const WOOD_DARK = "#a9762f";
const HOVER = "#f2c98a";

function Tower({
  sim,
  options,
  setOptions,
}: {
  sim: JengaSim;
  options: Placement[] | null;
  setOptions: (next: Placement[] | null) => void;
}) {
  const meshes = useRef(new Map<number, Mesh>());
  const acc = useRef(0);
  const wasPulling = useRef(false);

  const [hovered, setHovered] = useState<number | null>(null);
  const [, forceRender] = useState(0);

  useFrame((_, delta) => {
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

    // The extraction finished this frame: offer the placements for the plank.
    if (wasPulling.current && !sim.pulling) {
      setOptions(sim.placementOptions());
    }
    wasPulling.current = sim.pulling;
  });

  const canPull = (id: number, layer: number) => {
    if (options) return false;
    if (isTopLayer(layer)) return false;
    const left = sim.planks.filter((p) => p.layer === layer && !p.removed).length;
    return left > 1 && !sim.pulling;
  };

  const onPull = (id: number, layer: number) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!canPull(id, layer)) return;
    sim.beginPull(id, 1);
    forceRender((n) => n + 1);
  };

  const onPlace = (opt: Placement) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    sim.place(opt);
    sim.settle(0.6);
    setOptions(null);
    forceRender((n) => n + 1);
  };

  return (
    <group>
      {sim.planks.map((p) => {
        const he = halfExtents(p.alongX);
        const selectable = canPull(p.id, p.layer);
        return (
          <mesh
            key={p.id}
            ref={(m) => {
              if (m) meshes.current.set(p.id, m);
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
                !selectable
                  ? "#6b5233"
                  : hovered === p.id
                    ? HOVER
                    : p.alongX
                      ? WOOD
                      : WOOD_DARK
              }
              roughness={0.62}
              metalness={0.02}
            />
          </mesh>
        );
      })}

      {/* Where the extracted plank may go. Hovering targets, not physics bodies. */}
      {options?.map((o) => {
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
              opacity={0.28}
              wireframe
              roughness={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function StackTowerGame() {
  const [sim, setSim] = useState<JengaSim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Placement[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await JengaSim.create();
        s.settle(3.0);
        if (cancelled) return;
        // Debug handle: lets the sandbox and the agent inspect the live tower.
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

          <Tower sim={sim} options={options} setOptions={setOptions} />

          <mesh position={[0, -0.26, 0]} receiveShadow>
            <boxGeometry args={[26, 0.5, 26]} />
            <meshStandardMaterial color="#141416" roughness={0.9} />
          </mesh>

          <OrbitControls
            target={[0, (LAYERS * PLANK.h) / 2 + 1.2, 0]}
            enablePan={false}
            minDistance={9}
            maxDistance={28}
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
          <p className="font-display text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            {options
              ? "choose where the plank goes"
              : "drag to orbit · click a plank to pull it · the top layer is locked"}
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
