import { NextResponse } from "next/server";

import { isAddress } from "viem";

import { arcPublicClient } from "@/lib/arc";
import {
  LEAGUE_ABI,
  LEAGUE_ADDRESS,
  TIERS,
  USDC_ABI,
  USDC_ADDRESS,
  leagueDay,
  leagueDeployed,
  type LeagueStatus,
  type TierStatus,
} from "@/lib/leagues";
import { dateKey, isValidDateKey } from "@/lib/puzzles/date";
import { getAttempts, getSolves } from "@/lib/server/league-store";

export const dynamic = "force-dynamic";

/** GET /api/leagues/status?date=YYYY-MM-DD&address=0x…
 *  On-chain pots/entries plus the caller's entry, claim, attempt, and solve state. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? dateKey();
  if (!isValidDateKey(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const addrParam = url.searchParams.get("address");
  const address =
    addrParam && isAddress(addrParam)
      ? (addrParam.toLowerCase() as `0x${string}`)
      : null;

  const day = leagueDay(date);

  const tiers: TierStatus[] = TIERS.map((t) => ({
    id: t.id,
    name: t.name,
    fee: t.fee,
    feeUnits: t.feeUnits.toString(),
    potUnits: "0",
    entries: 0,
    settled: false,
    youEntered: false,
    youClaimUnits: "0",
    attemptsUsed: address ? getAttempts(date, t.id, address) : 0,
    solved: address ? getSolves(date, t.id).includes(address) : false,
  }));

  let usdcBalanceUnits = "0";
  let usdcAllowanceUnits = "0";
  let error: string | undefined;

  if (leagueDeployed) {
    try {
      const reads = await Promise.all(
        TIERS.flatMap((t) => [
          arcPublicClient.readContract({
            address: LEAGUE_ADDRESS,
            abi: LEAGUE_ABI,
            functionName: "pot",
            args: [day, t.id],
          }),
          arcPublicClient.readContract({
            address: LEAGUE_ADDRESS,
            abi: LEAGUE_ABI,
            functionName: "entries",
            args: [day, t.id],
          }),
          arcPublicClient.readContract({
            address: LEAGUE_ADDRESS,
            abi: LEAGUE_ABI,
            functionName: "settled",
            args: [day, t.id],
          }),
          ...(address
            ? [
                arcPublicClient.readContract({
                  address: LEAGUE_ADDRESS,
                  abi: LEAGUE_ABI,
                  functionName: "entered",
                  args: [day, t.id, address],
                }),
                arcPublicClient.readContract({
                  address: LEAGUE_ADDRESS,
                  abi: LEAGUE_ABI,
                  functionName: "prizeOf",
                  args: [address, day, t.id],
                }),
              ]
            : []),
        ]),
      );

      let i = 0;
      for (const t of tiers) {
        t.potUnits = (reads[i++] as bigint).toString();
        t.entries = Number(reads[i++] as bigint);
        t.settled = reads[i++] as boolean;
        if (address) {
          t.youEntered = reads[i++] as boolean;
          t.youClaimUnits = (reads[i++] as bigint).toString();
        }
      }

      if (address) {
        const [bal, allow] = await Promise.all([
          arcPublicClient.readContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: "balanceOf",
            args: [address],
          }),
          arcPublicClient.readContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: "allowance",
            args: [address, LEAGUE_ADDRESS],
          }),
        ]);
        usdcBalanceUnits = bal.toString();
        usdcAllowanceUnits = allow.toString();
      }
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "RPC error";
    }
  }

  const enteredTier = tiers.find((t) => t.youEntered && !t.settled)?.id ?? null;
  const solvedTier = tiers.find((t) => t.solved)?.id ?? null;

  return NextResponse.json({
    date,
    day: day.toString(),
    contractDeployed: leagueDeployed,
    error,
    usdcBalanceUnits,
    usdcAllowanceUnits,
    tiers,
    enteredTier,
    solvedTier,
  } satisfies LeagueStatus);
}
