"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAccount } from "wagmi";

import { ArcadeWordmark, RobotMark } from "@/components/brand/arcade-logo";
import { DailyPuzzle } from "@/components/daily-puzzle";
import { CabinetMarquee } from "@/components/games/cabinet-marquee";
import { LeaguePanel } from "@/components/league-panel";
import { RequireAccount } from "@/components/require-account";
import type { LeagueStatus } from "@/lib/leagues";
import { dateKey } from "@/lib/puzzles/date";

const STEPS = [
  { n: "01", label: "Same puzzle", body: "Everyone gets the same board at 00:00 UTC." },
  { n: "02", label: "One attempt", body: "Skill only — no retries, no paying for score." },
  { n: "03", label: "Settle up", body: "Winners split the pot in USDC on Arc." },
] as const;

export default function PlayPage() {
  const { address } = useAccount();
  const [status, setStatus] = useState<LeagueStatus | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const params = new URLSearchParams();
      if (address) params.set("address", address);
      try {
        const res = await fetch(`/api/leagues/status?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as LeagueStatus;
          if (!cancelled) setStatus(data);
        }
      } catch {
        // Keep previous state.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [address, refresh]);

  const refreshStatus = useCallback(() => setRefresh((r) => r + 1), []);

  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col bg-black text-zinc-50">
      <CabinetMarquee
        title="Daily Puzzle"
        badge="League"
        date={dateKey()}
        subtitle="Same board for every player · resets 00:00 UTC"
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-9">
        {/* The rules in three beats */}
        <section className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="pixel-card flex flex-col gap-2 rounded-sm p-3.5">
              <span className="arcade-gradient-text font-display text-xl leading-normal">
                {s.n}
              </span>
              <p className="font-display text-[10px] uppercase leading-relaxed tracking-[0.14em] text-zinc-200">
                {s.label}
              </p>
              <p className="text-xs leading-relaxed text-zinc-500">{s.body}</p>
            </div>
          ))}
        </section>

        <LeaguePanel status={status} onChanged={refreshStatus} />

        <RequireAccount title="the daily puzzle">
          <DailyPuzzle leagueStatus={status} />
        </RequireAccount>

        {/* Footer actions */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
          <Link href="/" className="arcade-btn-ghost">
            ← Back to the hall
          </Link>
          <Link
            href="/docs"
            className="font-display text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-white"
          >
            How the league works →
          </Link>
        </section>

        <div className="flex items-center justify-center gap-2 pb-2 pt-2 opacity-40">
          <RobotMark className="h-4 w-auto text-white" />
          <ArcadeWordmark
            className="h-3 w-auto text-white"
            gradientId="arcade-wordmark-play"
          />
        </div>
      </main>
    </div>
  );
}
