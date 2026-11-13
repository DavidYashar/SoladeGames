"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

const HALL_URL = "/models/hall/hall.glb";

type Station = {
  route: string;
  hot: [number, number, number];
  name: string;
  /** Camera where the fly-in ends, and what it looks at. */
  from: [number, number, number];
  look: [number, number, number];
  spot: [number, number, number];
};

const STATIONS: Station[] = [
  {
    name: "Neon Pinball",
    route: "/games/pinball",
    hot: [2.6, 2.6, 3.4],
    spot: [-6.4, 1.4, 3.2],
    from: [-6.4, 1.9, -1.1],
    look: [-6.4, 1.4, 3.2],
  },
  {
    name: "Brick Blitz",
    route: "/games/brick-blitz",
    hot: [5.4, 2.4, 3.4],
    spot: [0, 1.1, 1.4],
    from: [0, 2.0, -2.6],
    look: [0, 1.0, 1.4],
  },
  {
    name: "Stack Tower",
    route: "/games/stack-tower",
    hot: [4.2, 2.6, 4.2],
    spot: [6.2, 1.2, 3.2],
    from: [6.2, 1.9, -1.1],
    look: [6.2, 1.4, 3.2],
  },
];

/** The room, with a material per part group. */
function Hall() {
  const { scene } = useGLTF(HALL_URL);
  const grain = useTexture("/textures/hall-wood.png");
  const screens = useTexture([
    "/billboards/stack-tower.png",
    "/billboards/brick-blitz.png",
    "/billboards/pinball.png",
  ]);

  const model = useMemo(() => {
    grain.colorSpace = THREE.SRGBColorSpace;
    grain.anisotropy = 8;

    const floorTex = grain.clone();
    floorTex.needsUpdate = true;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(5, 5);

    const wallTex = grain.clone();
    wallTex.needsUpdate = true;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(6, 2);

    const floor = new THREE.MeshStandardMaterial({ map: floorTex, color: "#d8b489", roughness: 0.58, metalness: 0.05 });
    const wall = new THREE.MeshStandardMaterial({ map: wallTex, color: "#a97a4c", roughness: 0.7, metalness: 0.04 });
    const timber = new THREE.MeshStandardMaterial({ map: grain, color: "#8a5c34", roughness: 0.66, metalness: 0.04 });
    const barWood = new THREE.MeshStandardMaterial({ map: grain, color: "#a06c3c", roughness: 0.5, metalness: 0.05 });
    const brass = new THREE.MeshStandardMaterial({ color: "#c9a24c", roughness: 0.3, metalness: 0.95 });
    const bottle = new THREE.MeshPhysicalMaterial({ color: "#2a3a22", roughness: 0.15, transmission: 0.6, thickness: 0.3, transparent: true, opacity: 0.85 });
    const shade = new THREE.MeshStandardMaterial({ color: "#1d3a2a", roughness: 0.45, metalness: 0.6 });
    const bulb = new THREE.MeshStandardMaterial({ color: "#fff0d0", emissive: new THREE.Color("#ffcf8a"), emissiveIntensity: 4, toneMapped: false });
    const felt = new THREE.MeshStandardMaterial({ color: "#1e7a52", roughness: 0.92, metalness: 0.02 });
    const cabinet = new THREE.MeshStandardMaterial({ color: "#241a2c", roughness: 0.42, metalness: 0.35 });
    const neon = new THREE.MeshStandardMaterial({ color: "#ff2d55", emissive: new THREE.Color("#ff2d55"), emissiveIntensity: 4, toneMapped: false });
    const plank = new THREE.MeshStandardMaterial({ map: grain, color: "#c79a63", roughness: 0.6, metalness: 0.03 });
    const glyphA = new THREE.MeshBasicMaterial({ map: screens[0], toneMapped: false });
    const glyphB = new THREE.MeshBasicMaterial({ map: screens[1], toneMapped: false });
    const glyphC = new THREE.MeshBasicMaterial({ map: screens[2], toneMapped: false });
    const ball = new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.35, metalness: 0.2 });
    const leather = new THREE.MeshStandardMaterial({ color: "#7a3b1f", roughness: 0.45, metalness: 0.05 });
    const tumbler = new THREE.MeshPhysicalMaterial({
      color: "#dfeef2",
      roughness: 0.06,
      transmission: 0.88,
      thickness: 0.2,
      transparent: true,
      opacity: 0.55,
    });

    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const name = mesh.name;
      if (name.startsWith("Hot")) {
        mesh.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      } else if (name === "Floor") mesh.material = floor;
      else if (name.startsWith("Wall") || name === "Ceiling") mesh.material = wall;
      else if (name.startsWith("Beam")) mesh.material = timber;
      else if (name.startsWith("BarTop") || name.startsWith("BarBody")) mesh.material = barWood;
      else if (name.startsWith("BarShelf") || name === "BackBar") mesh.material = timber;
      else if (name.startsWith("BarBottle")) mesh.material = bottle;
      else if (name.startsWith("BarRail")) mesh.material = brass;
      else if (name.startsWith("LampShade")) mesh.material = shade;
      else if (name.startsWith("LampBulb")) mesh.material = bulb;
      else if (name.startsWith("LampCord")) mesh.material = timber;
      else if (name.startsWith("PoolFelt")) mesh.material = felt;
      else if (name.startsWith("PoolBalls")) mesh.material = ball;
      else if (name.startsWith("Pool")) {
        mesh.material = name.startsWith("PoolLeg") ? timber : barWood;
      } else if (name.startsWith("PinLeg")) mesh.material = brass;
      else if (name.startsWith("PinScreen")) mesh.material = glyphC;
      else if (name.startsWith("Pin")) mesh.material = cabinet;
      else if (name.startsWith("JengaPlank")) mesh.material = plank;
      else if (name.startsWith("JengaTop")) mesh.material = barWood;
      else if (name.startsWith("Jenga")) mesh.material = timber;
      else if (name === "NeonSign") mesh.material = neon;
      else if (name === "SignFrame") mesh.material = cabinet;
      else if (name.startsWith("BarPlank") || name === "BarWallPlanks") mesh.material = barWood;
      else if (name.startsWith("BarLed") || name.startsWith("BarStrip")) mesh.material = bulb;
      else if (name.startsWith("BarShaker")) mesh.material = brass;
      else if (name.startsWith("BarPlant")) mesh.material = felt;
      else if (name.startsWith("StoolSeat")) mesh.material = leather;
      else if (name.startsWith("Stool")) mesh.material = cabinet;
      else if (name.startsWith("BarGlassware")) mesh.material = tumbler;
      else mesh.material = timber;
      void glyphA;
      void glyphB;
    });
    return clone;
  }, [scene, grain, screens]);

  return <primitive object={model} />;
}

/** Camera that starts at the door and flies into a chosen station. */
function Rig({ flying, onArrived }: { flying: Station | null; onArrived: () => void }) {
  const { camera } = useThree();
  const to = useRef(new THREE.Vector3(0, 1.7, -7.4));
  const look = useRef(new THREE.Vector3(0, 1.6, 3));
  const target = useRef(new THREE.Vector3(0, 1.7, -7.4));
  const targetLook = useRef(new THREE.Vector3(0, 1.6, 3));
  const pos = useRef(new THREE.Vector3(0, 1.7, -7.4));
  const lookNow = useRef(new THREE.Vector3(0, 1.6, 3));

  useFrame((_, delta) => {
    if (flying) {
      target.current.set(...flying.from);
      targetLook.current.set(...flying.look);
    }
    const k = Math.min(1, delta * 2.4);
    pos.current.lerp(target.current, k);
    lookNow.current.lerp(targetLook.current, k);
    camera.position.copy(pos.current);
    camera.lookAt(lookNow.current);
    void to;
    void look;

    if (flying && pos.current.distanceTo(target.current) < 0.08) onArrived();
  });

  return null;
}

export function HallFront() {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [flying, setFlying] = useState<Station | null>(null);

  useEffect(() => {
    document.body.style.cursor = "auto";
  }, []);

  const pick = (station: Station) => {
    if (flying) return;
    setFlying(station);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [0, 1.7, -7.4], fov: 55, near: 0.1, far: 80 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#070506"]} />
        <fog attach="fog" args={["#0a0705", 16, 34]} />

        <ambientLight intensity={0.75} color="#ffe3c8" />
        <pointLight position={[-4.4, 2.6, 3]} intensity={34} color="#ffcf9a" distance={14} decay={2} />
        <pointLight position={[0, 2.6, 0.6]} intensity={34} color="#ffcf9a" distance={13} decay={2} />
        <pointLight position={[4.4, 2.6, 3]} intensity={34} color="#ffcf9a" distance={14} decay={2} />
        <pointLight position={[-5, 2.2, 6.4]} intensity={4} color="#ff4d5e" distance={8} decay={2} />
        <pointLight position={[5, 2.2, 6.4]} intensity={6} color="#22e0ff" distance={8} decay={2} />
        <pointLight position={[6.2, 1.6, 3.2]} intensity={8} color="#ffb066" distance={5} decay={2} />
        <pointLight position={[7.5, 3.2, 7.5]} intensity={12} color="#8fc6ff" distance={12} decay={2} />

        <Hall />

        {STATIONS.map((station) => (
          <Hotspot key={station.route} station={station} onPick={() => pick(station)} />
        ))}

        <Rig
          flying={flying}
          onArrived={() => {
            if (flying) router.push(flying.route);
          }}
        />
      </Canvas>

      {/* Entrance */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
          entered ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[#ff2d55]">Arc-ade</p>
        <h1 className="font-display mt-4 text-4xl uppercase tracking-[0.2em] text-zinc-100 sm:text-6xl">
          The Hall
        </h1>
        <p className="mt-3 max-w-sm text-center text-sm text-zinc-500">
          Three machines. Free to play. Solana settlement.
        </p>
        <button
          type="button"
          onClick={() => setEntered(true)}
          className="font-display mt-10 border border-[#ff2d55]/60 px-8 py-3 text-[11px] uppercase tracking-[0.35em] text-[#ff8fa3] transition-colors hover:border-[#ff2d55] hover:bg-[#ff2d55]/10 hover:text-white"
        >
          Walk in
        </button>
      </div>

      {/* The machines, also reachable without the 3D view */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-2 transition-opacity duration-700 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="font-display text-[10px] uppercase tracking-[0.3em] text-zinc-500">Pick a machine</p>
        <div className="pointer-events-auto flex gap-6">
          {STATIONS.map((station) => (
            <button
              key={station.route}
              type="button"
              onClick={() => pick(station)}
              className="font-display text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-white"
            >
              {station.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A click target sitting over each station. */
function Hotspot({ station, onPick }: { station: Station; onPick: () => void }) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) document.body.style.cursor = "pointer";
    else document.body.style.cursor = "auto";
  }, [hovered]);

  return (
    <mesh
      position={station.spot}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <boxGeometry args={station.hot} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
