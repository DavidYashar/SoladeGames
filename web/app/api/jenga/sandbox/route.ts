import { NextResponse } from "next/server";

import { runSandbox } from "@/lib/jenga/sandbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/jenga/sandbox?trials=6&pulls=24
 *
 * Runs the random-extraction experiment headless and returns the report. This exists
 * so the physics can be measured without a browser; it is not part of the game.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const trials = Math.max(1, Math.min(20, Number(url.searchParams.get("trials") ?? 6)));
  const pulls = Math.max(1, Math.min(40, Number(url.searchParams.get("pulls") ?? 24)));

  try {
    const report = await runSandbox(trials, pulls);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "sandbox failed" },
      { status: 500 },
    );
  }
}
