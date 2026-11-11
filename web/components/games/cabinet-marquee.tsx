import Link from "next/link";

import { RobotMark } from "@/components/brand/arcade-logo";

/**
 * Cabinet marquee — the lit sign above a machine.
 *
 * Chrome stays on the brand layer (black / white / cyan→violet); the
 * playfield below it keeps the steel-blue machine palette.
 */
export function CabinetMarquee({
  title,
  index,
  badge,
  date,
  subtitle,
}: {
  title: string;
  /** Machine number, 1-based — printed like a cabinet sticker. */
  index?: number;
  /** Overrides the right-hand sticker for non-machine pages. */
  badge?: string;
  date?: string;
  subtitle?: string;
}) {
  const sticker = badge ?? (index ? `Machine ${String(index).padStart(2, "0")}` : null);

  return (
    <div className="relative w-full border border-white/10 bg-black">
      <div className="scanlines relative flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <Link
          href="/"
          className="font-display shrink-0 text-[10px] uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-white"
        >
          <span aria-hidden>←</span>
          <span className="ml-1 hidden sm:inline">Hall</span>
          <span className="sr-only sm:hidden">Back to the hall</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <RobotMark className="h-5 w-auto shrink-0 text-white" />
          <h1 className="font-display truncate text-[11px] uppercase tracking-[0.1em] text-white sm:text-sm sm:tracking-[0.14em]">
            {title}
          </h1>
        </div>

        <div className="hidden shrink-0 items-center gap-2 font-display text-[9px] uppercase tracking-[0.16em] text-zinc-500 sm:flex">
          {sticker ? <span>{sticker}</span> : null}
          {date ? (
            <span className="hidden border-l border-white/15 pl-2 md:inline">
              {date}
            </span>
          ) : null}
        </div>
      </div>

      {/* marquee light strip */}
      <div aria-hidden className="arcade-bar h-[3px] w-full" />

      {subtitle ? (
        <p className="border-t border-white/5 bg-white/[0.02] px-3 py-1.5 text-center font-display text-[9px] uppercase tracking-[0.2em] text-zinc-500">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
