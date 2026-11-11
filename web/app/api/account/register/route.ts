import { NextResponse } from "next/server";

import bs58 from "bs58";
import nacl from "tweetnacl";

import {
  REGISTER_SIGNATURE_TTL_MS,
  buildRegisterMessage,
  checkUsername,
  normalizeUsername,
} from "@/lib/account";
import { isSolanaAddress } from "@/lib/solana";
import { registerPlayer } from "@/lib/server/players";

export const dynamic = "force-dynamic";

interface RegisterBody {
  address?: string;
  username?: string;
  signature?: string;
  issuedAt?: string;
}

/**
 * POST /api/account/register
 * Claims a handle for a wallet. The wallet must sign a message containing that exact
 * handle, proving ownership without spending gas. Solana wallets sign raw bytes with
 * Ed25519, so the signature arrives base58-encoded.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RegisterBody | null;

  if (!body || typeof body.address !== "string" || !isSolanaAddress(body.address)) {
    return NextResponse.json({ error: "A valid wallet address is required." }, { status: 400 });
  }
  if (typeof body.signature !== "string" || body.signature.length < 64) {
    return NextResponse.json({ error: "A wallet signature is required." }, { status: 400 });
  }
  if (typeof body.issuedAt !== "string") {
    return NextResponse.json({ error: "A signature timestamp is required." }, { status: 400 });
  }
  if (typeof body.username !== "string") {
    return NextResponse.json({ error: "A handle is required." }, { status: 400 });
  }

  const issued = Date.parse(body.issuedAt);
  if (Number.isNaN(issued)) {
    return NextResponse.json({ error: "Invalid timestamp." }, { status: 400 });
  }
  const age = Date.now() - issued;
  if (age > REGISTER_SIGNATURE_TTL_MS || age < -60_000) {
    return NextResponse.json(
      { error: "That signature expired — please try again." },
      { status: 410 },
    );
  }

  const check = checkUsername(body.username);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }
  const handle = check.value;
  const address = body.address;

  // The handle is inside the signed message, so a signature can never be replayed
  // to claim a different one.
  let signatureValid = false;
  try {
    signatureValid = nacl.sign.detached.verify(
      new TextEncoder().encode(buildRegisterMessage(handle, body.issuedAt)),
      bs58.decode(body.signature),
      bs58.decode(address),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return NextResponse.json(
      { error: "Signature does not match this wallet." },
      { status: 401 },
    );
  }

  const result = await registerPlayer(address, handle);
  if (!result.ok) {
    if (result.reason === "handle_taken") {
      return NextResponse.json(
        { error: `@${handle} is already taken.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "This wallet already has an account." },
      { status: 409 },
    );
  }

  return NextResponse.json({ player: result.player }, { status: 201 });
}

/** Handy for the client to normalise before signing. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("username") ?? "";
  const check = checkUsername(raw);
  return NextResponse.json({
    normalized: normalizeUsername(raw),
    available: check.ok,
    error: check.ok ? null : check.error,
  });
}
