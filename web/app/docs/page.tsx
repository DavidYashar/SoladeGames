import Link from "next/link";

import { ArcHeader } from "@/components/landing/arc-header";
import { Footer } from "@/components/landing/footer";
import { GridTunnel } from "@/components/landing/grid-tunnel";

const GAMES = [
  {
    name: "Stack Tower",
    machine: "Tower Machine",
    desc: "Tap to drop. Perfect alignment keeps your width.",
    identity: "Precision & timing",
  },
  {
    name: "Brick Blitz",
    machine: "Brick Machine",
    desc: "Paddle breaker with seeded walls and combos.",
    identity: "Waves, survival & power-ups",
  },
  {
    name: "Neon Pinball",
    machine: "Pinball Machine",
    desc: "Real physics: flippers, bumpers, spin, and a plunger.",
    identity: "Momentum, physics & combo mastery",
  },
] as const;

const MONEY = [
  ["Per-round play", "0.10 USDC", "60% prize reserve · 25% NFT holders · 15% platform"],
  ["Tournament entry", "0.10 USDC", "60% prize pool · 25% NFT holders · 15% platform"],
  ["Puzzle leagues (when live)", "0.10 / 0.50 / 1.00", "60% winners · 25% League Seats · 15% platform (separate rail)"],
] as const;

const MACHINES = [
  { name: "Tower Machine", game: "Stack Tower", identity: "Precision & timing" },
  { name: "Brick Machine", game: "Brick Blitz", identity: "Waves, survival & power-ups" },
  { name: "Pinball Machine", game: "Neon Pinball", identity: "Momentum, physics & combo mastery" },
] as const;


function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="neon-edge [--neon:#5b9fd8] mt-8 rounded-xl bg-white/[0.03] p-7 shadow-[0_0_0_1px_rgba(91,159,216,0.24),0_0_24px_-10px_rgba(91,159,216,0.5)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.25em] text-[#8fc0e8]">{kicker}</p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      <div className="mt-4 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="relative isolate min-h-screen bg-black text-zinc-50">
      <GridTunnel />
      <ArcHeader />

      <main className="relative mx-auto w-full max-w-4xl px-6 py-14">
        <p className="text-xs uppercase tracking-[0.35em] text-[#8fc0e8]">ARC-ADE</p>
        <h1 className="mt-2 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          Docs
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-400">
          A skill arcade hall on Arc. Practice free, compete in USDC, and own a
          slice of the hall.
        </p>

        <Section kicker="Overview" title="What is ARC-ADE?">
          <p>
            ARC-ADE is an arcade of skill games on Arc, where every win is backed
            by real USDC that players paid in. Same seeded board for everyone,
            free practice always, and optional paid rounds for those who want to
            compete. All entries, splits, and payouts are recorded on-chain —
            nothing is printed from thin air.
          </p>
          <p className="mt-3">
            Play to get good, compete for the pot, and earn a machine of the arcade.
            Each machine is a share of the hall that grows as people play.
          </p>
        </Section>

        <Section kicker="The plan" title="How it works — play, earn, own">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <span className="font-semibold text-zinc-200">Practice free.</span>{" "}
              Every machine runs a daily-seeded board that is identical for all
              players, so it&apos;s always about skill.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">Earn season points.</span>{" "}
              Your best verified scores across the four games build a capped
              season score. Play multiple machines and show up on different days
              to earn more.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">Qualify for the mint.</span>{" "}
              The top 1,000 eligible wallets at the season snapshot earn
              guaranteed whitelist access (ranks 1,001–1,500 get a reserve
              spot). One machine mint per wallet.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">Own a machine.</span>{" "}
              Your NFT is one of four machine types tied to a game. It&apos;s an
              identity and revenue-share asset — not a way to buy your way to the
              top of a leaderboard.
            </li>
            <li>
              <span className="font-semibold text-zinc-200">Compete for USDC.</span>{" "}
              Enter paid tournaments. Prizes go to multiple ranks, slot pools are
              published, and nothing about the economy depends on a token
              inflating.
            </li>
          </ol>
        </Section>

        <Section kicker="The games" title="Cabinet machines">
          <p className="mb-3">Four machines, each with a daily-seeded board that is identical for every player. Each one also maps to a machine NFT type.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {GAMES.map((g) => (
              <div
                key={g.name}
                className="rounded-lg bg-white/[0.02] p-4 transition-colors hover:bg-[#5b9fd8]/10 hover:text-[#a9d4f0]"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-zinc-100">{g.name}</p>
                  <span className="text-[10px] uppercase tracking-wider text-[#8fc0e8]">{g.machine}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{g.desc}</p>
                <p className="mt-1 text-xs text-zinc-600">{g.identity}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section kicker="Daily puzzle league" title="Puzzle rail">
          <p>
            A word, math, or logic puzzle each day (UTC). Play free and build
            streaks, or enter a paid league when the fee engine goes live. Puzzle
            answers are generated server-side and never shipped to the client.
          </p>
        </Section>

        <Section kicker="Tonight" title="Tournaments">
          <p>
            Pay a small USDC entry, play a daily-seeded board, and chase your best
            score. Prizes are paid to multiple ranks — not a single winner — and
            60% of the pool goes to the winner split, 25% to machine NFT holders,
            and 15% to the platform. Skill bands (Rookie through Champion) keep new
            players competing with their own tier. A weekly Grand Prix across all
            four machines crowns a champion for prestige.
          </p>
        </Section>

        <Section kicker="Money" title="How USDC moves">
          <p className="mb-3">No game token. No emissions. USDC on Arc, split on-chain with published rules.</p>
          <div className="space-y-2">
            {MONEY.map(([k, cost, split]) => (
              <div key={k} className="flex flex-col gap-1 rounded-lg bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-zinc-300">{k}</span>
                <span className="font-mono text-[#8fc0e8]">{cost}</span>
                <span className="text-xs text-zinc-500">{split}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Within the 60% prize pool, standard payout is 50% / 25% / 15% for 1st / 2nd / 3rd.
          </p>
        </Section>

        <Section kicker="Own" title="Machine NFTs">
          <p>
            Each machine NFT is a claim on real play — you earn it, you don&apos;t buy it.
            Holders receive a share of eligible game revenue because the hall is in
            use, not because a token inflated.
          </p>
          <p className="mt-3 mb-2">Four machine types, one per game:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MACHINES.map((m) => (
              <div key={m.name} className="rounded-lg bg-white/[0.02] p-3">
                <p className="text-sm font-semibold text-zinc-100">{m.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{m.game}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            A machine is a revenue-share and identity asset — never a competitive
            advantage. Assign a machine to one game each season to earn XP.
          </p>
        </Section>

        <Section kicker="Fair" title="Why this isn't P2E">
          <ul className="list-disc space-y-2 pl-5">
            <li>Same board — daily seed, identical machine for every player.</li>
            <li>Skill, not chance — best score wins; free practice is unlimited.</li>
            <li>Capped, normalized scoring — less time does not beat more skill.</li>
            <li>USDC on Arc — entries and payouts are dollars, no emissions.</li>
            <li>Machines are earned, never sold as a profit guarantee.</li>
          </ul>
        </Section>

        <Section kicker="Start" title="Getting started">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Connect your wallet (header, top right).</li>
            <li>Pick a machine and practice free.</li>
            <li>Fund USDC and compete when you&apos;re ready.</li>
            <li>Track your stats on your profile page.</li>
          </ol>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
