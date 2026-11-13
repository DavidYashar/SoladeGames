"use client";

import Link from "next/link";
import { useState } from "react";

import { SoladeWordmark, RobotMark } from "@/components/brand/arcade-logo";
import { ConnectWallet } from "@/components/connect-wallet";

/** Sticky top bar: brand, nav, live chain badge, wallet — with a mobile hamburger menu. */
const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// The demo build has no account routes, so the puzzle link is left out: it leads to a
// gate that cannot be satisfied without a server.
const NAV: ReadonlyArray<{ href: string; label: string }> = DEMO
  ? [
      { href: "/games/stack-tower", label: "Machines" },
      { href: "/docs", label: "Docs" },
    ]
  : [
      { href: "/games/stack-tower", label: "Machines" },
      { href: "/play", label: "Puzzle" },
      { href: "/docs", label: "Docs" },
    ];

export function ArcHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SolAde Games home">
          <SoladeWordmark className="h-5 w-auto text-white sm:h-[22px]" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className="arcade-underline font-display relative py-1 text-[11px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className={DEMO ? "hidden" : "hidden items-center gap-2 whitespace-nowrap rounded-sm border border-white/10 bg-white/[0.04] px-3 py-1.5 font-display text-[10px] uppercase tracking-wider text-zinc-300 lg:flex"}>
            <span className="arcade-eyes flex items-center gap-1" aria-hidden>
              <span className="block h-2 w-2 bg-[#22e0ff]" />
              <span className="block h-2 w-2 bg-[#22e0ff]" />
            </span>
            Solana Devnet
          </span>
          {DEMO ? null : (
            <div className="hidden md:block">
              <ConnectWallet />
            </div>
          )}
          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-white/15 bg-white/[0.04] text-zinc-200 transition-colors hover:border-[#22e0ff]/50 hover:text-white md:hidden"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            >
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* brand hairline: cyan → violet */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#22e0ff]/50 to-[#8b5cf6]/50"
      />

      <div
        className={`overflow-hidden border-t border-white/10 bg-black transition-[max-height,opacity,transform] duration-300 ease-out motion-reduce:transition-none md:hidden ${
          open ? "max-h-96 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"
        }`}
      >
        <nav className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1 px-6 py-4 text-center">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              onClick={() => setOpen(false)}
              className="font-display w-full max-w-xs rounded-sm px-6 py-3 text-[11px] uppercase tracking-[0.16em] text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {n.label}
            </Link>
          ))}
          {DEMO ? null : (
            <span className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <RobotMark className="h-4 w-auto text-white" />
              Solana Devnet · cluster devnet
            </span>
          )}
          <div className="mt-3 flex w-full max-w-xs justify-center">
            <ConnectWallet side="top" />
          </div>
        </nav>
      </div>
    </header>
  );
}
