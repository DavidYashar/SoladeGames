"use client";

import { useState } from "react";

type StageState = "live" | "next" | "planned";

interface Stage {
  letter: string;
  /** Short label under the node — must fit a 4-col grid on a 360px phone. */
  tab: string;
  title: string;
  state: StageState;
  body: string;
  points: string[];
}

const STAGES: Stage[] = [
  {
    letter: "A",
    tab: "Play",
    title: "Testnet foundation",
    state: "live",
    body: "Everything is free and nothing is paid. The four cabinets and the daily puzzle prove the games are genuinely fair before any money is involved.",
    points: [
      "Four cabinets with daily-seeded boards",
      "Same board for every player",
      "Daily puzzle, checked server-side",
      "Player handles and profiles",
    ],
  },
  {
    letter: "B",
    tab: "Season",
    title: "Season leaderboard",
    state: "next",
    body: "Rank players over a season instead of a single day, so one hot run cannot define a player and one bad day cannot end them.",
    points: [
      "Capped and normalized scoring",
      "Bonus for playing more than one cabinet",
      "Consistency beats one enormous day",
      "Scores verified before they count",
    ],
  },
  {
    letter: "C",
    tab: "Mint",
    title: "Machine mint",
    state: "planned",
    body: "The season snapshot is published, the ranking is frozen, and the machines are minted by the players who earned them.",
    points: [
      "Top 1,000 wallets guaranteed a mint",
      "Ranks 1,001–1,500 form the reserve",
      "One machine per wallet",
      "5,000 machines planned",
    ],
  },
  {
    letter: "D",
    tab: "Paid",
    title: "Paid tournaments",
    state: "planned",
    body: "The USDC rails go live with the split published on-chain before the first entry is taken.",
    points: [
      "Daily tournament on a host cabinet",
      "Three-tier puzzle league",
      "60 / 25 / 15 fixed and visible",
      "Winners pull their own payout",
    ],
  },
];

const BEYOND = [
  "Weekly Grand Prix",
  "Qualifier → final",
  "Challenge modes",
  "Skill bands",
  "Machine trading",
] as const;

const STATE_LABEL: Record<StageState, string> = {
  live: "Live now",
  next: "Up next",
  planned: "Planned",
};

/**
 * Interactive roadmap. The gradient track doubles as a scrubber: selecting a stage
 * fills the road up to it. Tabs use the standard tablist pattern so keyboard and
 * screen-reader users get the same behaviour.
 */
export function RoadmapSection() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];
  const fill = ((active + 1) / STAGES.length) * 100;

  return (
    <section id="roadmap" className="mx-auto w-full max-w-6xl px-6">
      <h2 className="font-display text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        The plan
      </h2>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="font-heading text-base leading-relaxed text-white sm:text-lg">
          Roadmap
        </p>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">
          Four stages, in order. Each one only makes sense once the one before it is
          solid.
        </p>
      </div>

      <div className="pixel-panel mt-6 rounded-sm">
        {/* ---------- track ---------- */}
        <div className="relative px-4 pb-4 pt-6 sm:px-8 sm:pt-8">
          {/* rail */}
          <div
            aria-hidden
            className="absolute left-[calc(12.5%+0.5rem)] right-[calc(12.5%+0.5rem)] top-[52px] h-[3px] bg-white/10 sm:top-[60px]"
          >
            <div
              className="arcade-bar h-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${fill}%` }}
            />
          </div>

          <div role="tablist" aria-label="Roadmap stages" className="relative grid grid-cols-4 gap-1 sm:gap-3">
            {STAGES.map((s, i) => {
              const selected = i === active;
              const reached = i <= active;
              return (
                <button
                  key={s.letter}
                  role="tab"
                  id={`roadmap-tab-${s.letter}`}
                  aria-selected={selected}
                  aria-controls="roadmap-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") setActive((a) => Math.min(a + 1, STAGES.length - 1));
                    if (e.key === "ArrowLeft") setActive((a) => Math.max(a - 1, 0));
                  }}
                  className="group flex flex-col items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#22e0ff] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span
                    className={`font-display flex h-11 w-11 items-center justify-center rounded-sm border-2 text-sm transition-colors sm:h-12 sm:w-12 ${
                      selected
                        ? "border-[#22e0ff] bg-[#22e0ff]/10 text-[#22e0ff] shadow-[0_0_0_3px_rgba(34,224,255,0.12)]"
                        : reached
                          ? "border-[#8b5cf6]/60 bg-[#8b5cf6]/10 text-zinc-200"
                          : "border-white/15 bg-black/60 text-zinc-500 group-hover:border-white/30 group-hover:text-zinc-300"
                    }`}
                  >
                    {s.letter}
                  </span>
                  <span
                    className={`font-display text-[9px] uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.14em] ${
                      selected ? "text-white" : "text-zinc-500"
                    }`}
                  >
                    {s.tab}
                  </span>
                  {s.state === "live" ? (
                    <span className="flex items-center gap-1 font-display text-[8px] uppercase tracking-[0.12em] text-[#22e0ff]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22e0ff]" />
                      live
                    </span>
                  ) : (
                    <span className="h-[13px]" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------- detail ---------- */}
        <div
          role="tabpanel"
          id="roadmap-panel"
          aria-labelledby={`roadmap-tab-${stage.letter}`}
          className="border-t-2 border-black/70 bg-white/[0.02] px-5 py-5 sm:px-8 sm:py-6"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-display text-lg leading-none text-[#22e0ff]">
              {stage.letter}
            </span>
            <h3 className="font-heading text-[11px] uppercase leading-relaxed text-white sm:text-xs">
              {stage.title}
            </h3>
            <StateBadge state={stage.state} />
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {stage.body}
          </p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {stage.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-zinc-300">
                <span aria-hidden className="mt-1.5 block h-1.5 w-1.5 shrink-0 bg-[#22e0ff]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---------- beyond launch ---------- */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="font-display text-[9px] uppercase tracking-[0.16em] text-zinc-600">
          Beyond launch
        </span>
        {BEYOND.map((b) => (
          <span
            key={b}
            className="pixel-well font-display rounded-sm px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-zinc-400"
          >
            {b}
          </span>
        ))}
      </div>
    </section>
  );
}

function StateBadge({ state }: { state: StageState }) {
  const styles: Record<StageState, string> = {
    live: "border-[#22e0ff]/50 bg-[#22e0ff]/10 text-[#22e0ff]",
    next: "border-[#8b5cf6]/50 bg-[#8b5cf6]/10 text-[#c4b5fd]",
    planned: "border-white/15 bg-white/[0.03] text-zinc-500",
  };
  return (
    <span
      className={`font-display ml-auto rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${styles[state]}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}
