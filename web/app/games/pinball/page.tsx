"use client";

import { CabinetMarquee } from "@/components/games/cabinet-marquee";
import { RequireAccount } from "@/components/require-account";
import { PinballGame } from "@/components/games/pinball-game";

export default function PinballPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-black text-zinc-50">
      <CabinetMarquee title="Neon Pinball" index={4} />
      <main className="flex w-full flex-1 flex-col items-center px-4 pb-4 pt-3">
        <div className="flex w-full max-w-xl flex-1 flex-col">
          <RequireAccount title="Neon Pinball">
            <PinballGame />
          </RequireAccount>
        </div>
      </main>
    </div>
  );
}
