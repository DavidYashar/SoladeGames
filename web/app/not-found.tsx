import Link from "next/link";

import { SoladeWordmark, RobotMark } from "@/components/brand/arcade-logo";

/** 404 — the robot lost the cabinet. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-black px-6 py-16 text-center text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[#22e0ff]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 h-[22rem] w-[22rem] rounded-full bg-[#8b5cf6]/10 blur-3xl"
      />

      <RobotMark className="h-24 w-auto text-white" />

      <p className="font-display mt-8 text-5xl tracking-[0.22em] text-white sm:text-7xl">
        404
      </p>
      <div aria-hidden className="arcade-bar mt-4 h-1 w-40" />

      <h1 className="font-display mt-6 text-xs uppercase tracking-[0.32em] text-zinc-300 sm:text-sm">
        Cabinet not found
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-500">
        This machine is not in the hall. It may have been moved, or the link was
        mistyped.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="arcade-btn">
          Back to the hall
        </Link>
        <Link href="/docs" className="arcade-btn-ghost">
          Read the docs
        </Link>
      </div>

      <SoladeWordmark
        className="mt-16 h-4 w-auto text-white/20"
      />
    </main>
  );
}
