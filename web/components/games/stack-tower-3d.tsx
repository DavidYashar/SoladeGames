"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";

import { DT, JengaSim } from "@/lib/jenga/sim";
import { LAYERS, PLANK, halfExtents, isTopLayer } from "@/lib/jenga/tower";

const WOOD = "#d8a45e";
const WOOD_DARK = "#a9762f";
const HOVER = "#f2c98a";

function Tower({ sim }: { sim: JengaSim }) {
  const meshes = useRef(new Map<number, Mesh>());
  const acc = useRef(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [, forceRender] = useState(0);

  useFrame((_, delta) => {
    if (!sim) return;

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
  });

  const planks = sim.planks;

  const legal = (id: number, layer: number) => {
    if (isTopLayer(layer)) return false;
    const left = sim.planks.filter((p) => p.layer === layer && !p.removed).length;
    return left > 1 && !sim.pulling;
  };

  const onPull = (id: number, layer: number) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!legal(id, layer)) return;
    sim.beginPull(id, 1);
    forceRender((n) => n + 1);
  };

  return (
    <group>
      {planks.map((p) => {
        const he = halfExtents(p.alongX);
        const canPull = legal(p.id, p.layer);
        return (
          <mesh
            key={p.id}
            ref={(m) => {
              if (m) meshes.current.set(p.id, m);
              else meshes.current.delete(p.id);
            }}
            position={[p.x, p.y, p.z]}
            onClick={onPull(p.id, p.layer)}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (canPull) setHovered(p.id);
            }}
            onPointerOut={() => setHovered(null)}
            visible={!p.removed}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[he.x * 2, he.y * 2, he.z * 2]} />
            <meshStandardMaterial
              color={
                !canPull ? "#6b5233" : hovered === p.id ? HOVER : p.alongX ? WOOD : WOOD_DARK
              }
              roughness={0.62}
              metalness={0.02}
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await JengaSim.create();
        s.settle(3.0);
        if (!cancelled) setSim(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "physics failed to start");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const camera = useMemo(() => ({ position: [11.5, 9.5, 11.5] as [number, number, number], fov: 42 }), []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0b0b0d]">
      {sim && (
        <Canvas shadows camera={camera} dpr={[1, 2]}>
          <color attach="background" args={["#0b0b0d"]} />
          <fog attach="fog" args={["#0b0b0d", 24, 46]} />

          <ambientLight intensity={0.55} />
          <directionalLight
            position={[8, 14, 6]}
            intensity={2.1}
            color="#fff2dd"
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <directionalLight position={[-9, 6, -7]} intensity={0.45} color="#9fb6d4" />

          <Tower sim={sim} />

          {/* Table */}
          <mesh position={[0, -0.26, 0]} receiveShadow>
            <boxGeometry args={[26, 0.5, 26]} />
            <meshStandardMaterial color="#141416" roughness={0.9} />
          </mesh>

          <OrbitControls
            target={[0, (LAYERS * PLANK.h) / 2, 0]}
            enablePan={false}
            minDistance={9}
            maxDistance={26}
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
            Drag to orbit · click a plank to pull it · the top layer is locked
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
