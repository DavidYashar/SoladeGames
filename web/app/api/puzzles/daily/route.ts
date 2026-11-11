import { NextResponse } from "next/server";

import { dateKey, isValidDateKey } from "@/lib/puzzles/date";
import { getDailyPuzzle } from "@/lib/puzzles/engine";

export const dynamic = "force-dynamic";

/** GET /api/puzzles/daily[?date=YYYY-MM-DD]
 *  Returns today's (or a specific date's) puzzle with no answer material. */
export function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("date") ?? dateKey();

  if (!isValidDateKey(requested)) {
    return NextResponse.json(
      { error: "Invalid date. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  return NextResponse.json(getDailyPuzzle(requested));
}
