import { ArcadeWordmark } from "@/components/brand/arcade-logo";

/** Boot screen — shown while a route streams in. */
export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-black px-6 text-white">
      <ArcadeWordmark className="h-6 w-auto text-white" />

      <div
        aria-hidden
        className="arcade-load-bar mt-5 h-1 w-36 overflow-hidden bg-white/10"
      />

      <p className="font-display mt-6 flex items-center gap-1 text-[10px] uppercase tracking-[0.35em] text-zinc-500">
        Booting
        <span className="arcade-cursor">_</span>
      </p>
    </main>
  );
}
