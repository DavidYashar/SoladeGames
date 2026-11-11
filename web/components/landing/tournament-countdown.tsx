"use client";

import { useEffect, useState } from "react";

/** Ticks down to the next UTC midnight (the daily cutoff). */
export function TournamentCountdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  const diff = now == null ? 0 : Math.max(0, next.getTime() - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ready = now != null;

  const units = [
    { label: "HRS", value: pad(h) },
    { label: "MIN", value: pad(m) },
    { label: "SEC", value: pad(s) },
  ];

  return (
    <div className="flex items-center gap-3">
      {units.map((u) => (
        <div
          key={u.label}
          className="flex min-w-[3.4rem] flex-col items-center rounded-md bg-black/30 px-3 py-2 shadow-[0_0_0_1px_rgba(91,159,216,0.25),0_0_14px_-8px_rgba(91,159,216,0.5)]"
        >
          <span className="font-mono text-2xl font-black text-[#8fc0e8]">
            {ready ? u.value : "--"}
          </span>
          <span className="text-[10px] tracking-widest text-zinc-500">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}
