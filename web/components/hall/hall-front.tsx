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
  const boards = useTexture("/textures/hall-floor-boards.jpg");
  const screens = useTexture([
    "/billboards/stack-tower.png",
    "/billboards/brick-blitz.png",
    "/billboards/pinball.png",
  ]);

  const neonMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ff4a3a",
        emissive: new THREE.Color("#ff1a0f"),
        emissiveIntensity: 9,
        roughness: 0.16,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        toneMapped: false,
      }),
    [],
  );

  const neonHalos = useMemo(
    () =>
      ([
        [0.999, 0.5, "#ffd2c8"],
        [1.05, 0.55, "#ff3b2a"],
        [1.16, 0.26, "#ff1a0f"],
      ] as const).map(
        ([scale, opacity, color]) =>
          ({
            scale,
            base: opacity,
            material: new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              toneMapped: false,
            }),
          }) as const,
      ),
    [],
  );

  const neonLight = useRef<THREE.PointLight>(null);

  const model = useMemo(() => {
    grain.colorSpace = THREE.SRGBColorSpace;
    grain.anisotropy = 8;

    // The lobby floor: warm oak boards, tiled across the room.
    const floorTex = boards;
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.anisotropy = 8;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(7, 6);
    floorTex.rotation = 0;
    floorTex.center.set(0.5, 0.5);

    const wallTex = grain.clone();
    wallTex.needsUpdate = true;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(6, 2);

    const floor = new THREE.MeshStandardMaterial({ map: floorTex, color: "#d9b98f", roughness: 0.5, metalness: 0.05 });
    const wall = new THREE.MeshStandardMaterial({ map: wallTex, color: "#a97a4c", roughness: 0.7, metalness: 0.04 });
    const timber = new THREE.MeshStandardMaterial({ map: grain, color: "#8a5c34", roughness: 0.66, metalness: 0.04 });
    const barWood = new THREE.MeshStandardMaterial({ map: grain, color: "#a06c3c", roughness: 0.5, metalness: 0.05 });
    const brass = new THREE.MeshStandardMaterial({ color: "#c9a24c", roughness: 0.3, metalness: 0.95 });
    const bottle = new THREE.MeshPhysicalMaterial({ color: "#2a3a22", roughness: 0.15, transmission: 0.6, thickness: 0.3, transparent: true, opacity: 0.85 });
    const shade = new THREE.MeshStandardMaterial({ color: "#2b2119", roughness: 0.42, metalness: 0.75 });
    const felt = new THREE.MeshStandardMaterial({ color: "#1e7a52", roughness: 0.92, metalness: 0.02 });
    const cabinet = new THREE.MeshStandardMaterial({ color: "#241a2c", roughness: 0.42, metalness: 0.35 });
    const neon = neonMaterial;
    const plank = new THREE.MeshStandardMaterial({ map: grain, color: "#c79a63", roughness: 0.6, metalness: 0.03 });
    const glyphA = new THREE.MeshBasicMaterial({ map: screens[0], toneMapped: false });
    const glyphB = new THREE.MeshBasicMaterial({ map: screens[1], toneMapped: false });
    const glyphC = new THREE.MeshBasicMaterial({ map: screens[2], toneMapped: false });
    const ball = new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.35, metalness: 0.2 });
    const facadeWood = new THREE.MeshStandardMaterial({
      map: grain,
      color: "#b8834e",
      roughness: 0.55,
      metalness: 0.04,
    });
    const leaf = new THREE.MeshStandardMaterial({ color: "#2f5a2c", roughness: 0.85, metalness: 0 });
    const potMat = new THREE.MeshStandardMaterial({ color: "#2a2a2c", roughness: 0.6, metalness: 0.2 });
    const signGlow = new THREE.MeshStandardMaterial({
      color: "#ffd9a6",
      emissive: new THREE.Color("#ffab5e"),
      emissiveIntensity: 6,
      toneMapped: false,
    });
    const strip = new THREE.MeshStandardMaterial({
      color: "#ffe1b8",
      emissive: new THREE.Color("#ffb877"),
      emissiveIntensity: 3,
      toneMapped: false,
    });
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
      else if (name === "NeonSign" || name === "NeonFrame") mesh.material = neon;
      else if (name === "FacadeSignText") mesh.material = signGlow;
      else if (name === "FacadeSignBoard") mesh.material = timber;
      else if (name.startsWith("FacadeTrim")) mesh.material = timber;
      else if (name.startsWith("FacadeLamp") || name.startsWith("FacadeBracket")) mesh.material = shade;
      else if (name.startsWith("FacadePot")) mesh.material = potMat;
      else if (name.startsWith("FacadeLeaf")) mesh.material = leaf;
      else if (name === "Apron") mesh.material = floor;
      else if (name.startsWith("Facade")) mesh.material = facadeWood;
      else if (name === "SignFrame") mesh.material = cabinet;
      else if (name.startsWith("BarPlank") || name === "BarWallPlanks") mesh.material = barWood;
      else if (name.startsWith("BarLed") || name.startsWith("BarStrip")) mesh.material = strip;
      else if (name.startsWith("BarShaker")) mesh.material = brass;
      else if (name.startsWith("BarPlant")) mesh.material = felt;
      else if (name.startsWith("StoolSeat")) mesh.material = leather;
      else if (name.startsWith("Stool")) mesh.material = cabinet;
      else if (name.startsWith("BarGlassware")) mesh.material = tumbler;
      else mesh.material = timber;
      void glyphA;
      void glyphB;
    });
    // Neon tube glow: additive shells around the letters and the frame alike.
    for (const partName of ["NeonSign", "NeonFrame"]) {
      const part = clone.getObjectByName(partName) as THREE.Mesh | undefined;
      if (!part) continue;
      for (const halo of neonHalos) {
        const shell = new THREE.Mesh(part.geometry, halo.material);
        shell.scale.setScalar(halo.scale);
        shell.raycast = () => {};
        part.add(shell);
      }
    }

    return clone;
  }, [scene, grain, boards, screens, neonMaterial, neonHalos]);

  return (
    <>
      <primitive object={model} />
      <pointLight
        ref={neonLight}
        position={[6.5, 3.7, 7.9]}
        color="#ff2416"
        intensity={7}
        distance={5.5}
        decay={2}
      />
      <NeonCycle tube={neonMaterial} halos={neonHalos} light={neonLight} />
    </>
  );
}

/** Camera that starts at the door and flies into a chosen station. */
function Rig({
  flying,
  entered,
  onArrived,
}: {
  flying: Station | null;
  entered: boolean;
  onArrived: () => void;
}) {
  const { camera } = useThree();
  // Outside the door at first, then through it into the hall.
  const OUTSIDE: [number, number, number] = [0, 2.1, -21];
  const OUTSIDE_LOOK: [number, number, number] = [0, 2.6, -8.3];
  const INSIDE: [number, number, number] = [0, 1.7, -7.2];
  const INSIDE_LOOK: [number, number, number] = [0, 1.6, 2.5];

  const to = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3(...OUTSIDE));
  const targetLook = useRef(new THREE.Vector3(...OUTSIDE_LOOK));
  const pos = useRef(new THREE.Vector3(...OUTSIDE));
  const lookNow = useRef(new THREE.Vector3(...OUTSIDE_LOOK));

  useFrame((_, delta) => {
    if (flying) {
      target.current.set(...flying.from);
      targetLook.current.set(...flying.look);
    } else if (entered) {
      target.current.set(...INSIDE);
      targetLook.current.set(...INSIDE_LOOK);
    } else {
      target.current.set(...OUTSIDE);
      targetLook.current.set(...OUTSIDE_LOOK);
    }
    const k = Math.min(1, delta * 2.4);
    pos.current.lerp(target.current, k);
    lookNow.current.lerp(targetLook.current, k);

    // An asymptotic lerp never arrives, and a camera that creeps forever makes every
    // thin edge in the room shimmer. Land it properly and stop.
    if (pos.current.distanceTo(target.current) < 0.002) pos.current.copy(target.current);
    if (lookNow.current.distanceTo(targetLook.current) < 0.002)
      lookNow.current.copy(targetLook.current);

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

  const enter = () => {
    if (flying) return;
    setEntered(true);
  };

  const leave = () => {
    setFlying(null);
    setEntered(false);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [0, 2.1, -21], fov: 55, near: 0.1, far: 90 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#070506"]} />
        <fog attach="fog" args={["#0a0705", 16, 34]} />

        {/* One pendant over each machine, and the light comes from those bulbs. A low
            ambient keeps the far corners from going black without inventing a source. */}
        <ambientLight intensity={0.34} color="#ffe0c6" />
        <Lamp at={[-6.4, 3.3, 3.2]} aim={[-6.4, 0.9, 3.2]} intensity={110} />
        <Lamp at={[0, 3.3, 1.4]} aim={[0, 0.9, 1.4]} intensity={110} />
        <Lamp at={[6.2, 3.3, 3.2]} aim={[6.2, 0.9, 3.2]} intensity={110} />

        {/* The lit strips under the back-bar shelves, as light rather than decoration. */}
        <pointLight position={[-2.6, 2.1, 7.4]} intensity={9} color="#ffc07a" distance={7.5} decay={2} />
        <pointLight position={[2.6, 2.1, 7.4]} intensity={9} color="#ffc07a" distance={7} decay={2} />

        {/* The two lamps beside the door. */}
        <pointLight position={[-3.9, 3.3, -8.9]} intensity={12} color="#ffcf9a" distance={7} decay={2} />
        <pointLight position={[3.9, 3.3, -8.9]} intensity={12} color="#ffcf9a" distance={7} decay={2} />

        {/* Spill from the hall, so the interior is legible through the doorway. */}
        <pointLight position={[0, 2.2, -6.6]} intensity={10} color="#ffc98a" distance={7} decay={2} />

        {/* The neon's own spill, not a lamp. */}
        <pointLight position={[4.9, 2.6, 7.6]} intensity={6} color="#ff2d55" distance={7} decay={2} />

        <Hall />
        {!entered && <Doorway onEnter={enter} />}

        {STATIONS.map((station) => (
          <Hotspot key={station.route} station={station} onPick={() => pick(station)} />
        ))}

        <Rig
          flying={flying}
          entered={entered}
          onArrived={() => {
            if (flying) router.push(flying.route);
          }}
        />
      </Canvas>

      {/* Entrance */}
      {/* Out again: the same door, from the other side. */}
      {entered && (
        <button
          type="button"
          onClick={leave}
          className="font-display absolute left-6 top-6 z-10 inline-flex items-center gap-2 border border-zinc-700/60 bg-black/40 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-zinc-400 transition-colors hover:border-[#ff4d3a]/60 hover:text-white"
        >
          <span aria-hidden="true">&larr;</span> Leave
        </button>
      )}

      {/* The entrance: the doorway stays visible, the words sit at the foot of the frame. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center bg-gradient-to-t from-black via-black/75 to-transparent pb-14 pt-32 transition-opacity duration-700 ${
          entered ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[#ff4d3a]">
          Solade Games
        </p>
        <h1 className="font-display mt-3 text-4xl uppercase tracking-[0.18em] text-zinc-100 sm:text-5xl">
          The Hall
        </h1>
        <p className="mt-3 max-w-sm text-center text-sm text-zinc-400">
          Three machines. Free to play. Solana settlement.
        </p>
        <button
          type="button"
          onClick={enter}
          className="font-display pointer-events-auto mt-8 border border-[#ff4d3a]/60 px-8 py-3 text-[11px] uppercase tracking-[0.35em] text-[#ff9d8a] transition-colors hover:border-[#ff4d3a] hover:bg-[#ff4d3a]/10 hover:text-white"
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

/**
 * The neon is on for ten seconds and off for two. It does not switch cleanly: a cold
 * tube stutters as it strikes, which is what makes it read as gas rather than a lamp.
 */
function NeonCycle({
  tube,
  halos,
  light,
}: {
  tube: THREE.MeshPhysicalMaterial;
  halos: readonly { material: THREE.MeshBasicMaterial; base: number }[];
  light: React.RefObject<THREE.PointLight | null>;
}) {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % 12;
    let level: number;

    if (t < 10) {
      if (t < 0.08) level = 0.1;
      else if (t < 0.16) level = 1;
      else if (t < 0.22) level = 0.2;
      else if (t < 0.3) level = 1;
      else if (t < 0.38) level = 0.55;
      else level = 1;
    } else {
      // Never fully dark: a cold tube still holds a dull red glow.
      level = 0.13;
    }

    // A lit tube is never perfectly calm.
    const hum = level > 0 ? 1 + Math.sin(clock.elapsedTime * 43) * 0.025 : 1;

    tube.emissiveIntensity = 9 * level * hum;
    for (const halo of halos) halo.material.opacity = halo.base * level;
    // The wall behind the sign catches the light while it is on, and just a hint when off.
    if (light.current) light.current.intensity = 7 * level;
  });

  return null;
}

/** One pendant bulb: a spot that actually aims at its own table. */
function Lamp({
  at,
  aim,
  intensity,
}: {
  at: [number, number, number];
  aim: [number, number, number];
  intensity: number;
}) {
  const { spot, target } = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(...aim);
    const spot = new THREE.SpotLight("#ffd9a6", intensity, 15, 0.82, 0.7, 2);
    // A spotlight only aims where its target sits, and that target must be in the scene.
    spot.target = target;
    return { spot, target };
  }, [aim, intensity]);

  return (
    <>
      <primitive object={spot} position={at} />
      <primitive object={target} />
      <pointLight position={at} intensity={7} color="#ffd9a6" distance={4.5} decay={2} />
    </>
  );
}

/** The open doorway: click it to walk in. */
function Doorway({ onEnter }: { onEnter: () => void }) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
  }, [hovered]);

  return (
    <mesh
      position={[0, 1.7, -8.32]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onEnter();
      }}
    >
      <boxGeometry args={[4.3, 3.3, 0.3]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
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
