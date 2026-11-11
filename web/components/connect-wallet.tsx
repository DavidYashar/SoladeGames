"use client";

import Link from "next/link";
import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

import { clearWalletCache } from "@/lib/wallet";
import { usePlayer } from "@/components/player-provider";

/** Minimal wallet widget. Connected = handle pill; hover/click shows brief details. */
export function ConnectWallet({
  side = "bottom",
}: { side?: "top" | "bottom" } = {}) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const { player } = usePlayer();
  const [open, setOpen] = useState(false);

  const handleDisconnect = () => {
    setOpen(false);
    disconnect();
    clearWalletCache();
  };

  if (isConnected && address) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-sm border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:border-[#22e0ff]/50 hover:text-white"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22e0ff] opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22e0ff] shadow-[0_0_10px_#22e0ff]" />
          </span>
          {player ? (
            <span className="font-display text-[11px] uppercase tracking-[0.08em]">
              @{player.username}
            </span>
          ) : (
            <span className="font-display text-[11px] uppercase tracking-[0.08em] text-amber-300">
              No handle
            </span>
          )}
        </button>

        {open && (
          <div
            className={`absolute right-0 z-50 w-60 rounded-sm border border-white/10 bg-black/95 p-4 backdrop-blur-xl motion-safe:animate-[menu-pop_0.18s_ease-out] ${
              side === "top" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              {player ? "Handle" : "Wallet"}
            </p>
            {player ? (
              <p className="font-display mt-1 text-sm text-white">@{player.username}</p>
            ) : (
              <p className="font-display mt-1 text-[11px] uppercase text-amber-300">
                Not registered
              </p>
            )}
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Balance:{" "}
              {balance
                ? `${formatUnits(balance.value, balance.decimals)} ${balance.symbol}`
                : "—"}
            </p>
            <Link
              href="/profile"
              className="mt-3 block w-full rounded-sm border border-white/15 bg-white/[0.04] px-4 py-2 text-center text-sm text-zinc-300 transition-colors hover:border-[#22e0ff]/50 hover:text-white"
            >
              View profile
            </Link>
            <button
              onClick={handleDisconnect}
              className="mt-2 w-full rounded-sm border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-[#22e0ff]/50 hover:text-white"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="arcade-btn arcade-btn-sm"
    >
      Connect Wallet
    </button>
  );
}
