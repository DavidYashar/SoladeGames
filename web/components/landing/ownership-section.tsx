/** Own a machine — beat 5, not the hero. Short and factual. */
export function OwnershipSection() {
  return (
    <section id="nft" className="mx-auto w-full max-w-6xl px-6">
      <div className="neon-edge pixel-raise [--neon:#8b5cf6] relative overflow-hidden rounded-sm bg-gradient-to-br from-[#8b5cf6]/10 via-transparent to-[#22e0ff]/8 p-8 backdrop-blur">
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-60 w-60 rounded-full bg-[#3f6f9d]/15 blur-3xl" />
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.25em] text-[#22e0ff]">
              Machine NFTs
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Own the machine people play.
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
              Each Arcade Machine NFT is a claim on real play. Holders earn USDC
              from round fees and tournament pots — because the hall is in use,
              not because a token inflated.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-zinc-300">
              <li className="flex items-center gap-2">
                <span className="text-[#8fc0e8]">◆</span> 50% of every paid round fee
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#5b9fd8]">◆</span> 20% of daily tournament pots
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#c9e2f5]">◆</span> Fixed supply (plan: 5,000 machines)
              </li>
            </ul>
          </div>
          <button
            disabled
            className="shrink-0 cursor-not-allowed rounded-sm border-2 border-white/15 bg-white/5 px-6 py-3 font-display text-xs uppercase tracking-[0.12em] text-zinc-500"
            title="Coming soon"
          >
            Marketplace · Coming soon
          </button>
        </div>
      </div>
    </section>
  );
}
