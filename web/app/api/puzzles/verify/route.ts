import { NextResponse } from "next/server";

import { isValidDateKey } from "@/lib/puzzles/date";
import { verifyPuzzle } from "@/lib/puzzles/engine";

export const dynamic = "force-dynamic";

interface VerifyBody {
  date?: string;
  answer?: string;
  reveal?: boolean;
}

/** POST /api/puzzles/verify { date, answer?, reveal? }
 *  Stateless verification. Returns:
 *   - { correct: true, answer } on a correct guess
 *   - { correct: false } on a wrong guess
 *   - { correct: false, revealAnswer } when reveal=true (free mode only) */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VerifyBody | null;

  if (!body || typeof body.date !== "string" || !isValidDateKey(body.date)) {
    return NextResponse.json(
      { error: "A valid date is required." },
      { status: 400 },
    );
  }

  const result = verifyPuzzle(
    body.date,
    typeof body.answer === "string" ? body.answer : null,
    body.reveal === true,
  );
  return NextResponse.json(result);
}
