/** Live on-chain activity feed. Placeholder rows — wired to events later. */
const FEED = [
  { id: 1, icon: "🎰", text: "A machine owner just earned rewards", time: "—" },
  { id: 2, icon: "🏆", text: "A player entered a daily tournament", time: "—" },
  { id: 3, icon: "🫧", text: "Neon Pinball round completed on-chain", time: "—" },
  { id: 4, icon: "🧩", text: "Daily puzzle league winner claimed USDC", time: "—" },
] as const;

export function ActivityFeed() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6">
      <div className="pixel-panel rounded-sm p-8">
        <h2 className="font-display text-[11px] uppercase tracking-[0.25em] text-zinc-500">
          Live on Arc
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Recent entries, settles &amp; claims — streaming once the league is live.
        </p>
        <div className="mt-5 divide-y divide-white/5">
          {FEED.map((f) => (
            <div key={f.id} className="flex items-center gap-4 py-3">
              <span className="text-2xl">{f.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-zinc-300">{f.text}</p>
                <p className="text-xs text-zinc-600">
                  <span className="text-emerald-400">● on-chain</span> · pending live data
                </p>
              </div>
              <span className="font-mono text-xs text-zinc-500">{f.time}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
