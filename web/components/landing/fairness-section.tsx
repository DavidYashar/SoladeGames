/** Fair — why this isn't P2E. Play-shaped, no wallet-first step. */
const TILES = [
  {
    n: "01",
    title: "Same board",
    body: "Daily seed. Every tournament player faces the identical machine.",
    accent: "text-[#5bc8ec]",
  },
  {
    n: "02",
    title: "Skill, not chance",
    body: "Best score wins. Free practice is unlimited and never paid.",
    accent: "text-[#5b9fd8]",
  },
  {
    n: "03",
    title: "USDC on Arc",
    body: "Entries and payouts are dollars, settled in under a second. No death-spiral game token.",
    accent: "text-[#8fc0e8]",
  },
  {
    n: "04",
    title: "On-chain split",
    body: "Anyone can verify the cut — we do not hide rake.",
    accent: "text-[#c9e2f5]",
  },
] as const;

export function FairnessSection() {
  return (
    <section id="fair" className="mx-auto w-full max-w-6xl px-6">
      <h2 className="font-display text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        Why this isn&apos;t P2E
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <div
            key={t.n}
            className="neon-edge pixel-raise [--neon:#22e0ff] rounded-sm bg-white/[0.03] p-6 backdrop-blur"
          >
            <p className={`font-mono text-xs font-bold ${t.accent}`}>{t.n}</p>
            <p className="mt-3 text-lg font-black text-zinc-50">{t.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{t.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
