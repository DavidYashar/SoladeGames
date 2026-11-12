"use client";

import { useEffect, useState } from "react";

type Accent = "sky" | "ocean" | "ice" | "indigo";
type Kind = "tower" | "brick" | "pinball";

interface CabinetProps {
  name: string;
  control: string;
  /** Present only when the cabinet is playable today. */
  route?: string;
  accent: Accent;
  kind: Kind;
  bestKey: string;
}

const ACCENT: Record<
  Accent,
  { text: string; hover: string; neon: string }
> = {
  sky: {
    text: "text-[#5bc8ec]",
    hover: "group-hover:shadow-[0_0_0_1px_rgba(91,200,236,0.5),0_0_30px_-8px_rgba(91,200,236,0.7)]",
    neon: "[--neon:#5bc8ec]",
  },
  ocean: {
    text: "text-[#4a90c8]",
    hover: "group-hover:shadow-[0_0_0_1px_rgba(74,144,200,0.5),0_0_30px_-8px_rgba(74,144,200,0.7)]",
    neon: "[--neon:#4a90c8]",
  },
  ice: {
    text: "text-[#8fc0e8]",
    hover: "group-hover:shadow-[0_0_0_1px_rgba(143,192,232,0.5),0_0_30px_-8px_rgba(143,192,232,0.7)]",
    neon: "[--neon:#8fc0e8]",
  },
  indigo: {
    text: "text-[#4f6ea0]",
    hover: "group-hover:shadow-[0_0_0_1px_rgba(79,110,160,0.5),0_0_30px_-8px_rgba(79,110,160,0.7)]",
    neon: "[--neon:#4f6ea0]",
  },
};

/* ---------- CSS art posters (static, game-like) ---------- */

function TowerScene() {
  const slabs = [100, 84, 72, 62, 54, 48];
  return (
    <div className="flex h-full flex-col items-center justify-end gap-1 px-4 pb-3">
      {slabs.map((w, i) => (
        <div
          key={i}
          style={{ width: `${w}%`, background: i % 2 ? "#2a7fb8" : "#3f97cc" }}
          className="h-3 rounded-sm shadow-[0_0_8px_rgba(91,159,216,0.5)]"
        />
      ))}
      <div className="h-3 w-[62%] animate-pulse rounded-sm bg-[#5bc8ec] shadow-[0_0_12px_rgba(91,159,216,0.9)] motion-reduce:animate-none" />
    </div>
  );
}

function BrickScene() {
  const bricks = Array.from({ length: 24 });
  return (
    <div className="flex h-full flex-col justify-between px-3 pb-3 pt-4">
      <div className="grid grid-cols-6 gap-1">
        {bricks.map((_, i) => (
          <div
            key={i}
            className="h-2 rounded-[2px] bg-[#4a90c8]/80 shadow-[0_0_4px_rgba(74,144,200,0.4)]"
            style={{ opacity: 0.5 + ((i % 5) * 0.12) }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="h-2 w-2 rounded-full bg-[#8fc0e8] shadow-[0_0_10px_rgba(143,192,232,0.9)]" />
        <div className="h-2.5 w-16 rounded-full bg-[#5b9fd8] shadow-[0_0_10px_rgba(91,159,216,0.8)]" />
      </div>
    </div>
  );
}

function PinballScene() {
  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-x-3 bottom-2 top-2 rounded-t-[3rem] border border-[#4f6ea0]/40 bg-[#101c3a]/40" />
      <div className="absolute left-6 top-10 h-5 w-5 rounded-full bg-[#5b9fd8] shadow-[0_0_10px_rgba(91,159,216,0.8)]" />
      <div className="absolute right-6 top-16 h-4 w-4 rounded-full bg-[#8fc0e8] shadow-[0_0_10px_rgba(143,192,232,0.8)]" />
      <div className="absolute left-1/2 top-1/3 h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
      <div className="absolute bottom-4 left-3 h-2 w-16 -rotate-[24deg] rounded-full bg-[#5b9fd8] shadow-[0_0_8px_rgba(91,159,216,0.9)]" />
      <div className="absolute bottom-4 right-3 h-2 w-16 rotate-[24deg] rounded-full bg-[#5b9fd8] shadow-[0_0_8px_rgba(91,159,216,0.9)]" />
    </div>
  );
}

/* ---------- single cabinet ---------- */

export function CabinetPreview({
  name,
  route,
  control,
  accent,
  kind,
  bestKey,
}: CabinetProps) {
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    const v = Number(window.localStorage.getItem(bestKey) || 0);
    setBest(v > 0 ? v : null);
  }, [bestKey]);

  const a = ACCENT[accent];

  return (
    <div
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-sm border-2 border-white/10 bg-[#0e0e16] shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.10),inset_-2px_-2px_0_0_rgba(0,0,0,0.9),0_6px_0_-1px_#05050a,0_14px_26px_-12px_rgba(0,0,0,0.9)] transition-all motion-safe:hover:-translate-y-1.5 motion-safe:hover:shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.16),inset_-2px_-2px_0_0_rgba(0,0,0,0.9),0_9px_0_-1px_#05050a,0_20px_32px_-12px_rgba(34,224,255,0.28)] ${a.neon} neon-edge ${a.hover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fc0e8]`}
    >
      {/* Marquee */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <span className={`font-display text-xs uppercase tracking-[0.1em] ${a.text}`}>
          {name}
        </span>
        <span className="font-mono text-[10px] text-zinc-600">{control}</span>
      </div>

      {/* Bezel + screen */}
      <div className="mx-4 mt-2 rounded-md bg-black p-1.5 shadow-[0_0_0_1px_rgba(91,159,216,0.3),0_0_14px_-8px_rgba(91,159,216,0.4)]">
        <div className="aspect-[4/5] overflow-hidden rounded-sm bg-[#05050f]">
          {kind === "tower" && <TowerScene />}
          {kind === "brick" && <BrickScene />}
          {kind === "pinball" && <PinballScene />}
        </div>
      </div>

      {/* Control deck */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-3">
        {route ? (
          <span className="rounded-md bg-[#22e0ff]/15 px-2.5 py-1 text-[10px] font-semibold text-[#22e0ff]">
            Play
          </span>
        ) : (
          <span className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-zinc-400">
            3D rebuild
          </span>
        )}
        {best != null && (
          <span className="ml-auto text-[10px] text-zinc-500">
            Best{" "}
            <span className={`font-mono font-bold ${a.text}`}>{best}</span>
          </span>
        )}
      </div>
    </div>
  );
}
