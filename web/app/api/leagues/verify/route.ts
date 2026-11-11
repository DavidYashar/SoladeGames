import { NextResponse } from "next/server";

import { isAddress, verifyMessage } from "viem";

import { arcPublicClient } from "@/lib/arc";
import {
  LEAGUE_ABI,
  LEAGUE_ADDRESS,
  buildSolveMessage,
  leagueDay,
  leagueDeployed,
  type PaidVerifyResult,
  type TierId,
} from "@/lib/leagues";
import { isValidDateKey } from "@/lib/puzzles/date";
import { getDailyPuzzle, verifyPuzzle } from "@/lib/puzzles/engine";
import {
  getAttempts,
  getSolves,
  recordAttempt,
  recordSolve,
} from "@/lib/server/league-store";

export const dynamic = "force-dynamic";

interface VerifyBody {
  date?: string;
  tier?: number;
  answer?: string;
  address?: string;
  signature?: string;
}

/** POST /api/leagues/verify
 *  Paid-league answer verification. Requires:
 *   1. A wallet signature proving ownership of the address.
 *   2. An on-chain paid entry for this day + tier.
 *   3. Attempt budget tracked server-side.
 *  No reveal path — answers stay server-side until settle. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VerifyBody | null;

  if (!body || typeof body.date !== "string" || !isValidDateKey(body.date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }
  if (
    typeof body.tier !== "number" ||
    !Number.isInteger(body.tier) ||
    body.tier < 0 ||
    body.tier > 2
  ) {
    return NextResponse.json({ error: "A valid tier is required." }, { status: 400 });
  }
  if (typeof body.answer !== "string" || !body.answer.trim()) {
    return NextResponse.json({ error: "An answer is required." }, { status: 400 });
  }
  if (typeof body.signature !== "string" || !isAddress(body.address ?? "")) {
    return NextResponse.json(
      { error: "A valid wallet address and signature are required." },
      { status: 401 },
    );
  }
  if (!leagueDeployed) {
    return NextResponse.json(
      { error: "League contract not deployed yet." },
      { status: 400 },
    );
  }

  const address = body.address!.toLowerCase() as `0x${string}`;
  const tier = body.tier as TierId;
  const day = leagueDay(body.date);

  // 1. Prove wallet ownership.
  let validSig = false;
  try {
    validSig = await verifyMessage({
      address,
      message: buildSolveMessage(body.date, tier),
      signature: body.signature as `0x${string}`,
    });
  } catch {
    validSig = false;
  }
  if (!validSig) {
    return NextResponse.json(
      { error: "Invalid signature. Connect and sign to verify." },
      { status: 401 },
    );
  }

  // 2. Must have paid on-chain for this day + tier.
  let entered = false;
  try {
    entered = await arcPublicClient.readContract({
      address: LEAGUE_ADDRESS,
      abi: LEAGUE_ABI,
      functionName: "entered",
      args: [day, tier, address],
    });
  } catch {
    entered = false;
  }
  if (!entered) {
    return NextResponse.json(
      { error: "No paid entry found for this league." },
      { status: 403 },
    );
  }

  // 3. Server-side attempt budget.
  const allowed = getDailyPuzzle(body.date).attemptsAllowed;
  const used = getAttempts(body.date, tier, address);
  const solvedAlready = getSolves(body.date, tier).includes(address);
  if (used >= allowed) {
    return NextResponse.json(
      {
        correct: false,
        solved: solvedAlready,
        message: "Out of attempts for this league.",
        attemptsUsed: used,
      } satisfies PaidVerifyResult,
      { status: 429 },
    );
  }

  // 4. Check the answer.
  const result = verifyPuzzle(body.date, body.answer, false);
  if (result.correct) {
    recordSolve(body.date, tier, address);
    return NextResponse.json({
      correct: true,
      solved: true,
      message: result.message,
      attemptsUsed: used + 1,
    } satisfies PaidVerifyResult);
  }

  const newUsed = recordAttempt(body.date, tier, address);
  return NextResponse.json({
    correct: false,
    solved: false,
    message:
      newUsed >= allowed
        ? "Out of attempts for this league."
        : `${result.message} (${allowed - newUsed} left)`,
    attemptsUsed: newUsed,
  } satisfies PaidVerifyResult);
}
