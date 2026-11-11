"use client";

import { useState } from "react";

import { useAccount, useWriteContract } from "wagmi";

import {
  LEAGUE_ABI,
  LEAGUE_ADDRESS,
  USDC_ABI,
  USDC_ADDRESS,
  formatUsdc,
  type LeagueStatus,
  type TierStatus,
} from "@/lib/leagues";

interface Props {
  status: LeagueStatus | null;
  onChanged: () => void;
}

/** Paid league card row: enter / claim, pots, entry state. */
export function LeaguePanel({ status, onChanged }: Props) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<number | "claim" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(tier: TierStatus) {
    if (!status || !isConnected) return;
    setBusy(tier.id);
    setError(null);
    try {
      if (BigInt(status.usdcAllowanceUnits) < BigInt(tier.feeUnits)) {
        await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [LEAGUE_ADDRESS, BigInt(tier.feeUnits)],
        });
      }
      await writeContractAsync({
        address: LEAGUE_ADDRESS,
        abi: LEAGUE_ABI,
        functionName: "enter",
        args: [BigInt(status.day), tier.id],
      });
      onChanged();
    } catch (e) {
      setError((e as Error)?.message?.slice(0, 160) ?? "Transaction failed.");
    } finally {
      setBusy(null);
    }
  }

  async function claim(tier: TierStatus) {
    if (!status || !isConnected) return;
    setBusy("claim");
    setError(null);
    try {
      await writeContractAsync({
        address: LEAGUE_ADDRESS,
        abi: LEAGUE_ABI,
        functionName: "claim",
        args: [BigInt(status.day), tier.id],
      });
      onChanged();
    } catch (e) {
      setError((e as Error)?.message?.slice(0, 160) ?? "Transaction failed.");
    } finally {
      setBusy(null);
    }
  }

  const deployed = Boolean(status?.contractDeployed);

  return (
    <section className="pixel-panel rounded-sm p-5 sm:p-6">
      {/* panel header rail */}
      <div className="-mx-5 -mt-5 mb-4 flex items-center justify-between gap-3 border-b-2 border-black/70 bg-white/[0.03] px-5 py-3 sm:-mx-6 sm:-mt-6 sm:px-6">
        <h2 className="font-heading text-[11px] uppercase leading-relaxed text-white sm:text-xs">
          Paid leagues
        </h2>
        <span className="font-display shrink-0 text-[9px] uppercase tracking-[0.16em] text-[#22e0ff]">
          USDC · 60/25/15
        </span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        60% winners · 25% NFT holder pool · 15% platform
      </p>

      {!deployed ? (
        <p className="pixel-well mt-4 rounded-sm p-3 text-xs leading-relaxed text-zinc-400">
          {status?.error
            ? `RPC error: ${status.error}`
            : isConnected
              ? "League contract not deployed yet — set NEXT_PUBLIC_LEAGUE_ADDRESS and restart."
              : "Connect your wallet to join paid leagues."}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {status!.tiers.map((t) => {
              const inThis = t.youEntered && !t.settled;
              return (
                <div
                  key={t.id}
                  className={`flex flex-col rounded-sm border-2 p-3.5 ${
                    inThis
                      ? "border-[#22e0ff]/60 bg-[#22e0ff]/[0.07] shadow-[inset_2px_2px_0_0_rgba(0,0,0,0.6),0_3px_0_-1px_#05050a]"
                      : "pixel-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-[11px] uppercase tracking-[0.1em] text-zinc-100">
                      {t.name}
                    </p>
                    <p className="font-display shrink-0 text-[10px] text-[#22e0ff]">
                      {t.fee}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Pot {formatUsdc(t.potUnits)} · {t.entries} in
                  </p>

                  <div className="mt-auto pt-3">
                    {t.settled ? (
                      BigInt(t.youClaimUnits) > 0n ? (
                        <button
                          onClick={() => claim(t)}
                          disabled={busy !== null}
                          className="arcade-btn w-full !px-3 !py-2 !text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy === "claim"
                            ? "Claiming…"
                            : `Claim ${formatUsdc(t.youClaimUnits)}`}
                        </button>
                      ) : (
                        <p className="font-display py-2 text-center text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                          Settled
                        </p>
                      )
                    ) : inThis ? (
                      <p className="pixel-well rounded-sm py-2 text-center font-display text-[10px] uppercase tracking-[0.1em] text-[#22e0ff]">
                        In{t.solved ? " · solved" : ""}
                      </p>
                    ) : (
                      <button
                        onClick={() => enter(t)}
                        disabled={!isConnected || busy !== null}
                        className="arcade-btn-ghost w-full !px-3 !py-2 !text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === t.id ? "Entering…" : "Enter"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {error && (
            <p className="mt-3 border-l-2 border-red-500 pl-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
