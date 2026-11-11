import Link from "next/link";

import { TournamentCountdown } from "./tournament-countdown";

const SPLIT = [
  { label: "Winner", pct: "60%", color: "bg-[#22e0ff]" },
  { label: "NFT holders", pct: "25%", color: "bg-[#8b5cf6]" },
  { label: "Platform", pct: "15%", color: "bg-zinc-600" },
] as const;

/** Tonight — daily tournament (arcade 60/20/20). Pot is an honest empty state. */
export function TournamentBanner() {
  return (
    <section id="tournament" className="mx-auto w-full max-w-6xl px-6">
      <div className="neon-edge pixel-raise [--neon:#22e0ff] relative overflow-hidden rounded-sm bg-gradient-to-br from-[#0a0a12] via-[#101024] to-[#0a0a12] p-8 backdrop-blur">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#22e0ff]/10 blur-3xl" />
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-[#22e0ff]">
              Tonight
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              🏆 Stack Royale{" "}
              <span className="text-sm font-medium text-zinc-500">
                · Stack Tower · same seeded board
              </span>
            </h2>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              Pay 1 USDC. Play for your best score. Highest score when the clock
              hits 00:00 UTC takes{" "}
              <span className="font-semibold text-[#c9e2f5]">60% of the pot</span>.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="#machines" className="arcade-btn">
                Practice the board
              </Link>
              <Link href="#money" className="arcade-btn-ghost">
                How entry works
              </Link>
            </div>
            <div className="mt-6">
              <TournamentCountdown />
            </div>
          </div>

          <div className="shrink-0 text-left lg:text-right">
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              Current pot
            </p>
            <p className="mt-1 font-mono text-2xl font-black leading-tight text-zinc-200">
              Pot goes live with paid entries
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Every USDC in the pot came from a player
            </p>
          </div>
        </div>

        {/* Tonight's split */}
        <div className="mt-8">
          <p className="mb-2 font-display text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Tonight&apos;s split
          </p>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            <div className="w-[60%] bg-[#22e0ff]" />
            <div className="w-[25%] bg-[#8b5cf6]" />
            <div className="w-[15%] bg-zinc-600" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
            {SPLIT.map((s) => (
              <span
                key={s.label}
                className="flex items-center gap-2 text-xs text-zinc-400"
              >
                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                {s.pct} {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
