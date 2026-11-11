"use client";

import { CabinetMarquee } from "@/components/games/cabinet-marquee";
import { RequireAccount } from "@/components/require-account";
import { StackTowerGame } from "@/components/games/stack-tower-game";
import { dateKey } from "@/lib/puzzles/date";

export default function StackTowerPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-black text-zinc-50">
      <CabinetMarquee title="Stack Tower" index={1} date={dateKey()} />
      <main className="flex w-full flex-1 flex-col items-center px-4 py-5">
        <div className="w-full max-w-xl">
          <RequireAccount title="Stack Tower">
            <StackTowerGame />
          </RequireAccount>
        </div>
      </main>
    </div>
  );
}
