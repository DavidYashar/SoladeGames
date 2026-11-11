import Link from "next/link";

import { dateKey } from "@/lib/puzzles/date";
import { getDailyPuzzle } from "@/lib/puzzles/engine";

const TYPE_ICON: Record<string, string> = {
  word: "🔤",
  math24: "🔢",
  sequence: "🧩",
};

/** Today's puzzle — rail 2. Compact, date-forward, deep-links to /play. */
export function FeaturedPuzzle() {
  const puzzle = getDailyPuzzle(dateKey());
  const icon = TYPE_ICON[puzzle.type] ?? "🧩";

  return (
    <section id="puzzle" className="mx-auto w-full max-w-6xl px-6">
      <div className="neon-edge pixel-raise [--neon:#22e0ff] relative overflow-hidden rounded-sm bg-gradient-to-br from-[#22e0ff]/8 via-transparent to-[#8b5cf6]/10 p-6 backdrop-blur sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#5b9fd8]/10 blur-3xl" />
        <p className="font-display text-[11px] uppercase tracking-[0.25em] text-[#22e0ff]">
          Today&apos;s puzzle
        </p>
        <div className="mt-3 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-black">
              <span className="text-2xl">{icon}</span>
              {puzzle.title}
            </h2>
            <p className="mt-1 max-w-md text-sm text-zinc-400">{puzzle.blurb}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {puzzle.date} · {puzzle.attemptsAllowed} attempts · free to play
            </p>
          </div>
          <Link
            href="/play"
            className="arcade-btn-ghost shrink-0"
          >
            Play today →
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Free today. Paid Copper · Silver · Gold leagues when the contract is
          up.
        </p>
      </div>
    </section>
  );
}
