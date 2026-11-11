"use client";

import { useEffect, useState } from "react";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { ConnectWallet } from "@/components/connect-wallet";
import { RobotMark } from "@/components/brand/arcade-logo";
import { ArcHeader } from "@/components/landing/arc-header";
import { Footer } from "@/components/landing/footer";
import { GridTunnel } from "@/components/landing/grid-tunnel";
import { useStats } from "@/hooks/use-stats";
import { SOLANA_CLUSTER } from "@/lib/solana";

const BEST_KEYS = [
  { label: "Stack Tower", key: "imarket:stack-tower:best" },
  { label: "Brick Blitz", key: "imarket:brick-blitz:best" },
  { label: "Bubble Pop", key: "imarket:bubble-pop:best" },
  { label: "Neon Pinball", key: "imarket:pinball:best" },
] as const;

const NEON = "shadow-[0_0_0_1px_rgba(91,159,216,0.24),0_0_24px_-10px_rgba(91,159,216,0.5)]";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] p-3">
      <p className="font-display text-xl text-[#22e0ff]">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  const stats = useStats();
  const [bests, setBests] = useState<Record<string, number | null>>({});
  const [sol, setSol] = useState<number | null>(null);

  const address = publicKey?.toBase58();

  useEffect(() => {
    const out: Record<string, number | null> = {};
    for (const { label, key } of BEST_KEYS) {
      const v = Number(window.localStorage.getItem(key) || 0);
      out[label] = v > 0 ? v : null;
    }
    setBests(out);
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setSol(null);
      return;
    }
    let cancelled = false;
    void connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (!cancelled) setSol(lamports / LAMPORTS_PER_SOL);
      })
      .catch(() => {
        if (!cancelled) setSol(null);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  return (
    <div className="relative isolate min-h-screen bg-black text-zinc-50">
      <GridTunnel />
      <ArcHeader />

      <main className="relative mx-auto w-full max-w-3xl px-6 py-14">
        <p className="font-display text-[11px] uppercase tracking-[0.28em] text-[#22e0ff]">
          Account
        </p>
        <h1 className="mt-2 text-4xl font-black">Profile</h1>

        {!connected || !address ? (
          <div className="relative mt-8 overflow-hidden rounded-sm border border-white/10 bg-white/[0.02] p-10 text-center">
            <RobotMark className="mx-auto h-16 w-auto text-white" />
            <p className="font-display mt-5 text-xs uppercase tracking-[0.24em] text-zinc-300">
              No player card yet
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-500">
              Connect a wallet to see your best runs on every cabinet.
            </p>
            <div className="mt-6 flex justify-center">
              <ConnectWallet />
            </div>
            <div
              aria-hidden
              className="arcade-bar absolute inset-x-0 bottom-0 h-0.5 opacity-60"
            />
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className={`rounded-xl bg-white/[0.03] p-6 ${NEON}`}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Wallet</p>
              <p className="mt-1 font-mono text-lg text-zinc-100">
                {address.slice(0, 4)}…{address.slice(-4)}
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Balance: {sol != null ? `${sol.toFixed(3)} SOL` : "—"}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-600">
                {SOLANA_CLUSTER}
              </p>
            </div>

            <div className={`rounded-xl bg-white/[0.03] p-6 ${NEON}`}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Daily puzzle</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="Solved" value={String(stats.totalSolved)} />
                <Stat label="Streak" value={String(stats.currentStreak)} />
                <Stat label="Best streak" value={String(stats.bestStreak)} />
              </div>
            </div>

            <div className={`rounded-xl bg-white/[0.03] p-6 ${NEON}`}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Personal bests</p>
              <div className="mt-3 space-y-2">
                {BEST_KEYS.map(({ label, key }) => {
                  const b = bests[label];
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{label}</span>
                      <span className="font-mono text-zinc-100">{b != null ? b : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => void disconnect()}
              className="rounded-lg bg-white/5 px-5 py-2.5 text-sm text-zinc-300 shadow-[0_0_0_1px_rgba(91,159,216,0.22),0_0_14px_-8px_rgba(91,159,216,0.4)] transition-all hover:text-[#a9d4f0] hover:shadow-[0_0_0_1px_rgba(91,159,216,0.5),0_0_18px_-8px_rgba(91,159,216,0.6)]"
            >
              Disconnect
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
