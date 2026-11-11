import { NextResponse } from "next/server";

import { runPolicySandbox, runSandbox } from "@/lib/jenga/sandbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/jenga/sandbox
 *
 *   ?mode=policy&trials=4&pulls=40   both sides play the math model, with placement
 *   ?mode=random&trials=6&pulls=40   both sides pick at random, with placement
 *   (default)                        random pulls only, no placement
 *
 * Exists so the physics and the opponent can be measured without a browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const trials = Math.max(1, Math.min(20, Number(url.searchParams.get("trials") ?? 6)));
  const pulls = Math.max(1, Math.min(60, Number(url.searchParams.get("pulls") ?? 24)));
  const mode = url.searchParams.get("mode");

  try {
    if (mode === "policy" || mode === "random") {
      return NextResponse.json(await runPolicySandbox(trials, pulls, mode === "random"));
    }
    return NextResponse.json(await runSandbox(trials, pulls));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "sandbox failed" },
      { status: 500 },
    );
  }
}
