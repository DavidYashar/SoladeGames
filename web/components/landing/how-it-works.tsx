const STEPS = [
  {
    icon: "🔌",
    title: "Connect your wallet",
    desc: "One click via MetaMask or any injected wallet on Arc.",
  },
  {
    icon: "💰",
    title: "Load USDC",
    desc: "Fund your account with USDC — the native gas & payout token on Arc.",
  },
  {
    icon: "🎮",
    title: "Play & win",
    desc: "Enter a game room or league. Instant, auditable payouts on-chain.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6">
      <h2 className="font-display text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        How it works
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="pixel-card relative rounded-sm p-6"
          >
            <span className="absolute right-5 top-5 font-mono text-xs text-zinc-600">
              0{i + 1}
            </span>
            <p className="text-3xl">{s.icon}</p>
            <p className="mt-3 text-lg font-bold text-zinc-50">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
