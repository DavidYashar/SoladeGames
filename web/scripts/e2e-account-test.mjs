#!/usr/bin/env node
/**
 * End-to-end test for the player account API.
 *
 *   node scripts/e2e-account-test.mjs [baseUrl]
 *
 * Generates a throwaway wallet, signs a real registration message, and asserts the
 * happy path plus the three rejection paths. Requires the app to be running and
 * DATABASE_URL to point at a dev database.
 */
import { randomBytes } from "node:crypto";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const base = process.argv[2] ?? "http://localhost:3000";

/** Must match buildRegisterMessage() in lib/account.ts exactly. */
function buildRegisterMessage(username, issuedAt) {
  return [
    "ARC-ADE",
    "Claim your player handle",
    "",
    `Handle: ${username}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(body) {
  const res = await fetch(`${base}/api/account/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/* ---------- wallet + signature ---------- */

const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);
const suffix = randomBytes(3).toString("hex");
const handle = `t${suffix}`;
const issuedAt = new Date().toISOString();
const signature = await account.signMessage({
  message: buildRegisterMessage(handle, issuedAt),
});

/* ---------- 1. happy path ---------- */

const created = await post({
  address: account.address,
  username: handle,
  signature,
  issuedAt,
});
check(
  "register a fresh wallet",
  created.status === 201 && created.json?.player?.username === handle,
  `status ${created.status}`,
);

/* ---------- 2. read it back ---------- */

const readRes = await fetch(`${base}/api/account/${account.address}`);
const read = await readRes.json();
check(
  "GET returns the player card",
  readRes.status === 200 &&
    read.player?.username === handle &&
    read.player?.totalPoints === 0 &&
    Array.isArray(read.results),
  `status ${readRes.status}`,
);

/* ---------- 3. same wallet again is idempotent-ish (409, not a duplicate row) ---------- */

const again = await post({
  address: account.address,
  username: handle,
  signature,
  issuedAt,
});
check("re-registering the same wallet is harmless", again.json?.player?.username === handle, `status ${again.status}`);

/* ---------- 4. handle already taken by another wallet ---------- */

const other = privateKeyToAccount(generatePrivateKey());
const issued2 = new Date().toISOString();
const sig2 = await other.signMessage({
  message: buildRegisterMessage(handle, issued2),
});
const taken = await post({
  address: other.address,
  username: handle,
  signature: sig2,
  issuedAt: issued2,
});
check("a taken handle is rejected", taken.status === 409, `status ${taken.status}`);

/* ---------- 5. signature from the wrong wallet ---------- */

const forged = await post({
  address: other.address,
  username: `forged${suffix}`,
  signature: signature, // signed by the first wallet, not `other`
  issuedAt,
});
check("a signature from another wallet is rejected", forged.status === 401, `status ${forged.status}`);

/* ---------- 6. validation ---------- */

const badHandle = await post({
  address: other.address,
  username: "A", // too short / uppercase
  signature: sig2,
  issuedAt: issued2,
});
check("a short handle is rejected", badHandle.status === 400, `status ${badHandle.status}`);

/* ---------- 7. expired signature ---------- */

const staleIssued = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const staleSig = await other.signMessage({
  message: buildRegisterMessage(`stale${suffix}`, staleIssued),
});
const stale = await post({
  address: other.address,
  username: `stale${suffix}`,
  signature: staleSig,
  issuedAt: staleIssued,
});
check("an expired signature is rejected", stale.status === 410, `status ${stale.status}`);

/* ---------- 8. unknown wallet ---------- */

const missingRes = await fetch(`${base}/api/account/0x9999999999999999999999999999999999999999`);
check("unknown wallet returns 404", missingRes.status === 404, `status ${missingRes.status}`);

/* ---------- summary ---------- */

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`test handle: @${handle} · wallet ${account.address}`);
process.exit(failed.length === 0 ? 0 : 1);
