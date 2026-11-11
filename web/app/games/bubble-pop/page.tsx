"use client";

import { CabinetMarquee } from "@/components/games/cabinet-marquee";
import { RequireAccount } from "@/components/require-account";
import { BubblePopGame } from "@/components/games/bubble-pop-game";
import { dateKey } from "@/lib/puzzles/date";

export default function BubblePopPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-black text-zinc-50">
      <CabinetMarquee title="Bubble Pop" index={3} date={dateKey()} />
      <main className="flex w-full flex-1 flex-col items-center px-4 py-5">
        <div className="w-full max-w-xl">
          <RequireAccount title="Bubble Pop">
            <BubblePopGame />
          </RequireAccount>
        </div>
      </main>
    </div>
  );
}
