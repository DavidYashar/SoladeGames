"use client";

import { CabinetMarquee } from "@/components/games/cabinet-marquee";
import { RequireAccount } from "@/components/require-account";
import { BrickBlitzGame } from "@/components/games/brick-blitz-game";
import { dateKey } from "@/lib/puzzles/date";

export default function BrickBlitzPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-black text-zinc-50">
      <CabinetMarquee title="Brick Blitz" index={2} date={dateKey()} />
      <main className="flex w-full flex-1 flex-col items-center px-4 py-5">
        <div className="w-full max-w-2xl">
          <RequireAccount title="Brick Blitz">
            <BrickBlitzGame />
          </RequireAccount>
        </div>
      </main>
    </div>
  );
}
