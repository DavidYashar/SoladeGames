import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="font-black tracking-tight">
            <span className="bg-gradient-to-r from-[#8fc0e8] to-[#5b9fd8] bg-clip-text text-transparent">
              ARC-ADE
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Play · Compete · Own the hall — settled in USDC on Arc.
          </p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
          <Link href="#machines" className="transition-colors hover:text-zinc-300">
            Machines
          </Link>
          <Link href="#tournament" className="transition-colors hover:text-zinc-300">
            Tonight
          </Link>
          <Link href="/play" className="transition-colors hover:text-zinc-300">
            Puzzle
          </Link>
          <Link href="#nft" className="transition-colors hover:text-zinc-300">
            Own
          </Link>
          <Link href="/docs" className="transition-colors hover:text-zinc-300">
            Docs
          </Link>
        </nav>
        <div className="text-center text-xs text-zinc-600 sm:text-right">
          <p>Chain ID 5042002 · rpc.testnet.arc.io</p>
          <p className="mt-1">Testnet build — on-chain rewards go live with mainnet.</p>
        </div>
      </div>
    </footer>
  );
}
