/** Live stats strip. Placeholder values — wired to on-chain reads later. */
const STATS = [
  {
    label: "Total USDC in pots",
    value: "—",
    sub: "Live once leagues deploy",
    accent: "text-amber-300",
  },
  {
    label: "Players today",
    value: "—",
    sub: "Coming soon",
    accent: "text-cyan-300",
  },
  {
    label: "Machines live",
    value: "4",
    sub: "Tower · Brick · Bubble · Pinball",
    accent: "text-emerald-300",
  },
  {
    label: "Payout split",
    value: "60/25/15",
    sub: "Winners · NFT · Platform",
    accent: "text-fuchsia-300",
  },
] as const;

export function LiveStats() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="pixel-card rounded-sm p-5"
          >
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              {s.label}
            </p>
            <p className={`mt-2 font-mono text-3xl font-black ${s.accent}`}>
              {s.value}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
