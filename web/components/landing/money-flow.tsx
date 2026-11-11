/** Money — how USDC moves. Two rails, honest about what's live. */
const RAILS = [
  {
    title: "Per-round play",
    accent: "text-[#8fc0e8]",
    bar: "bg-[#5b9fd8]",
    rows: [
      ["Cost", "0.10 USDC deducted from your account"],
      ["Split", "50% → NFT holders"],
      ["Remainder", "TBD"],
    ],
    note: "Free practice does not deduct.",
  },
  {
    title: "Daily tournament",
    accent: "text-[#5b9fd8]",
    bar: "bg-[#8fc0e8]",
    rows: [
      ["Cost", "1.00 USDC once per machine per day"],
      ["Split", "60% winner · 20% team · 20% NFT holders"],
    ],
    note: "Best score at the UTC-midnight cutoff.",
  },
] as const;

export function MoneyFlow() {
  return (
    <section id="money" className="mx-auto w-full max-w-6xl px-6">
      <div className="neon-edge pixel-raise [--neon:#22e0ff] rounded-sm bg-white/[0.03] p-8 backdrop-blur">
        <h2 className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-2xl font-black text-transparent">
          Every dollar in was paid by a player.
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          No game token. No emissions. USDC on Arc, split on-chain.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {RAILS.map((r) => (
            <div
              key={r.title}
              className="rounded-lg bg-white/[0.02] p-6 shadow-[0_0_0_1px_rgba(91,159,216,0.22),0_0_18px_-10px_rgba(91,159,216,0.45)]"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${r.bar}`} />
                <h3 className={`text-lg font-black ${r.accent}`}>{r.title}</h3>
              </div>
              <dl className="mt-4 space-y-2">
                {r.rows.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-4 text-sm"
                  >
                    <dt className="text-zinc-500">{k}</dt>
                    <dd className="text-right text-zinc-200">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-zinc-600">{r.note}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-zinc-600">
          Puzzle leagues (when live): Copper 0.10 · Silver 0.50 · Gold 1.00
          USDC · split 60% winners / 25% League Seats / 15% platform.
        </p>

        <div className="mt-6 rounded-lg bg-[#5b9fd8]/5 px-4 py-3 text-sm text-[#bcd8ef] shadow-[0_0_0_1px_rgba(91,159,216,0.25),0_0_18px_-10px_rgba(91,159,216,0.5)]">
          Testnet build. Practice is live. USDC splits go live with the fee
          engine.
        </div>
      </div>
    </section>
  );
}
