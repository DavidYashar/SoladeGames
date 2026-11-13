"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

const BAR_URL = "/models/hall/bar.glb";

const GAMES = [
  { name: "Stack Tower", route: "/games/stack-tower", shot: "/billboards/stack-tower.png", x: 2.55 },
  { name: "Brick Blitz", route: "/games/brick-blitz", shot: "/billboards/brick-blitz.png", x: 0 },
  { name: "Neon Pinball", route: "/games/pinball", shot: "/billboards/pinball.png", x: -2.55 },
];

/** The bar, with a material per part group. */
function Bar() {
  const { scene } = useGLTF(BAR_URL);
  const grain = useTexture("/textures/table-wood.png");

  const parts = useMemo(() => {
    grain.colorSpace = THREE.SRGBColorSpace;
    grain.anisotropy = 8;

    const wood = new THREE.MeshStandardMaterial({
      map: grain,
      color: "#b98a5c",
      roughness: 0.5,
      metalness: 0.05,
    });
    const darkWood = new THREE.MeshStandardMaterial({
      map: grain,
      color: "#6b4527",
      roughness: 0.62,
      metalness: 0.04,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: "#c8a04a",
      roughness: 0.28,
      metalness: 0.95,
    });
    const bottleGlass = new THREE.MeshPhysicalMaterial({
      color: "#20452e",
      roughness: 0.12,
      metalness: 0,
      transmission: 0.75,
      thickness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    const tumbler = new THREE.MeshPhysicalMaterial({
      color: "#dfeef2",
      roughness: 0.05,
      metalness: 0,
      transmission: 0.9,
      thickness: 0.2,
      transparent: true,
      opacity: 0.6,
    });
    const neon = new THREE.MeshStandardMaterial({
      color: "#ff2d55",
      emissive: new THREE.Color("#ff2d55"),
      emissiveIntensity: 3.2,
      toneMapped: false,
    });
    const neonCool = new THREE.MeshStandardMaterial({
      color: "#22e0ff",
      emissive: new THREE.Color("#22e0ff"),
      emissiveIntensity: 2.6,
      toneMapped: false,
    });

    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const name = mesh.name;
      if (name.startsWith("Bottle")) mesh.material = bottleGlass;
      else if (name.startsWith("Glass")) mesh.material = tumbler;
      else if (name.startsWith("Rail") || name.startsWith("Bracket")) mesh.material = brass;
      else if (name === "NeonText") mesh.material = neon;
      else if (name === "NeonSub") mesh.material = neonCool;
      else if (
        name.startsWith("Counter") ||
        name.startsWith("Groove") ||
        name.startsWith("Shelf")
      )
        mesh.material = wood;
      else mesh.material = darkWood;
    });
    return clone;
  }, [scene, grain]);

  return <primitive object={parts} />;
}

/** One game screen: a lit panel with its screenshot, on a neon frame. */
function Screen({
  shot,
  x,
  onSelect,
}: {
  shot: string;
  x: number;
  onSelect: () => void;
}) {
  const texture = useTexture(shot);
  const [hovered, setHovered] = useState(false);
  const frame = useRef<THREE.MeshStandardMaterial>(null);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // The frame is turned to face the room, which mirrors the image; flip it back.
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  texture.offset.x = 1;

  useFrame(() => {
    if (!frame.current) return;
    frame.current.emissiveIntensity +=
      ((hovered ? 1.6 : 0.4) - frame.current.emissiveIntensity) * 0.15;
  });

  return (
    <group position={[x, 3.42, 1.62]} rotation={[0, Math.PI, 0]}>
      {/* Frame */}
      <mesh position={[0, 0, -0.035]}>
        <boxGeometry args={[2.62, 1.55, 0.06]} />
        <meshStandardMaterial ref={frame} color="#101014" emissive="#ff2d55" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      {/* The game itself */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <planeGeometry args={[2.5, 1.41]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The room: bar, screens, neon, and the odd passing light. */
function Room({ onPick }: { onPick: (route: string) => void }) {
  const rig = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((_, delta) => {
    // Barely-there parallax, so the room feels physical rather than a flat image.
    if (!rig.current) return;
    const targetY = pointer.x * 0.22;
    const targetX = -pointer.y * 0.1;
    rig.current.rotation.y += (targetY - rig.current.rotation.y) * Math.min(1, delta * 2.2);
    rig.current.rotation.x += (targetX - rig.current.rotation.x) * Math.min(1, delta * 2.2);
  });

  return (
    <group ref={rig}>
      <Bar />
      {GAMES.map((game) => (
        <Screen key={game.route} shot={game.shot} x={game.x} onSelect={() => onPick(game.route)} />
      ))}

      {/* Room: floor and back wall, so the bar is not floating. */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#120d0a" roughness={0.75} metalness={0.15} />
      </mesh>
      <mesh position={[0, 4, -6]} receiveShadow>
        <planeGeometry args={[40, 18]} />
        <meshStandardMaterial color="#0a0807" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function HallFront() {
  const router = useRouter();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = "auto";
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [0, 2.35, -6.1], fov: 52, near: 0.1, far: 60 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        onCreated={({ camera }) => camera.lookAt(0, 2.1, 0)}
      >
        <color attach="background" args={["#070506"]} />
        <fog attach="fog" args={["#070506", 12, 30]} />

        <ambientLight intensity={0.8} color="#ffe9d2" />
        <pointLight position={[0, 3.4, -1.6]} intensity={24} color="#ffd2a1" distance={14} decay={2} />
        <pointLight position={[-3.4, 2.6, -2.2]} intensity={3} color="#ff4d5e" distance={8} decay={2} />
        <pointLight position={[3.4, 2.6, -2.2]} intensity={3.5} color="#22e0ff" distance={8} decay={2} />
        <spotLight
          position={[0, 6.5, -3]}
          angle={0.85}
          penumbra={0.9}
          intensity={20}
          color="#ffe6c2"
          target-position={[0, 1.2, 0]}
        />

        <Room onPick={(route) => router.push(route)} />
      </Canvas>

      {/* Entrance */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
          entered ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[#ff2d55]">
          Arc-ade
        </p>
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

      {/* Billboard labels, only once inside */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1 transition-opacity duration-700 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="font-display text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          Pick a machine
        </p>
        <div className="pointer-events-auto flex gap-6">
          {GAMES.map((game) => (
            <button
              key={game.route}
              type="button"
              onClick={() => router.push(game.route)}
              className="font-display text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-white"
            >
              {game.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
