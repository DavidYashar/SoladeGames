import { NextResponse } from "next/server";

import { isSolanaAddress } from "@/lib/solana";

import type { ProfilePayload } from "@/lib/account";
import { getBestScores, getPlayer, getPlayerResults, touchPlayer } from "@/lib/server/players";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/:address
 * The public player card: handle, lifetime totals, tournament placements and
 * per-cabinet bests. Returns 404 when the wallet has not registered.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
) {
  const { address } = await context.params;

  if (!isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  }

  const player = await getPlayer(address);
  if (!player) {
    return NextResponse.json({ registered: false }, { status: 404 });
  }

  const [results, bestScores] = await Promise.all([
    getPlayerResults(address),
    getBestScores(address),
  ]);

  // Fire-and-forget: last_seen_at is telemetry, not part of the response.
  void touchPlayer(address).catch(() => {});

  return NextResponse.json({
    registered: true,
    player,
    results,
    bestScores,
  } satisfies ProfilePayload & { registered: true });
}
