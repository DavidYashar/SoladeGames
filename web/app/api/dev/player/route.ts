import { NextResponse } from "next/server";

import { PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

/**
 * Stand-in identity for `next dev`, so the four cabinets render without a wallet.
 *
 * The gate in components/require-account.tsx is UX; the server still refuses writes
 * from unregistered wallets. This route only fabricates the read-side player, and it
 * answers 404 outside development, so a production deployment cannot be bypassed.
 */
const DEV_PLAYER = {
  // A valid 32-byte Solana address, derived rather than hand-written, so the same
  // value works anywhere the app validates an address.
  address: new PublicKey(new Uint8Array(32).fill(7)).toBase58(),
  username: "devplayer",
  createdAt: new Date(0).toISOString(),
  totalPoints: 0,
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  bestRank: null as number | null,
};

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ player: DEV_PLAYER });
}
