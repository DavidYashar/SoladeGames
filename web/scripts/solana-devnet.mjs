/**
 * Devnet bootstrap for Arkade on Solana.
 *
 *   node scripts/solana-devnet.mjs
 *
 * Creates (once) a devnet keypair and a 9-decimal, $1-pegged test token, then funds
 * the treasury with a starting float. Both live in web/.keys/, which is gitignored.
 *
 * The 9-decimal / one-token-one-dollar shape is deliberate: it mirrors the asset
 * Bankroll settles charges in, so game code written against this test token keeps
 * working if we ever move the money rail there.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const keysDir = path.join(webRoot, ".keys");
const keypairPath = path.join(keysDir, "devnet.json");
const mintPath = path.join(keysDir, "devnet-mint.json");

const DECIMALS = 9;
const STARTING_FLOAT = 1_000_000; // whole tokens, minted to the treasury
const MIN_SOL = 0.5;

function loadEnvLocal() {
  const file = path.join(webRoot, ".env.local");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function loadOrCreateKeypair() {
  mkdirSync(keysDir, { recursive: true });
  if (existsSync(keypairPath)) {
    const secret = JSON.parse(readFileSync(keypairPath, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const keypair = Keypair.generate();
  writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)), {
    mode: 0o600,
  });
  console.log(`created keypair  ${keypairPath}`);
  return keypair;
}

const env = loadEnvLocal();
const rpcUrl = process.env.SOLANA_RPC_URL ?? env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
const connection = new Connection(rpcUrl, "confirmed");

console.log(`rpc              ${rpcUrl}`);

const payer = loadOrCreateKeypair();
console.log(`treasury         ${payer.publicKey.toBase58()}`);

let balance = await connection.getBalance(payer.publicKey);
if (balance < MIN_SOL * LAMPORTS_PER_SOL) {
  console.log("requesting a devnet airdrop...");
  try {
    const signature = await connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(signature, "confirmed");
    balance = await connection.getBalance(payer.publicKey);
  } catch (error) {
    console.error(`airdrop failed: ${error.message}`);
    console.error("use https://faucet.solana.com with the treasury address above, then rerun.");
  }
}
console.log(`balance          ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

if (balance === 0) {
  console.error("no SOL to pay for the mint; nothing else to do yet.");
  process.exit(1);
}

/** @type {{ mint: string, decimals: number, signature: string } | null} */
let record = existsSync(mintPath) ? JSON.parse(readFileSync(mintPath, "utf8")) : null;

if (!record) {
  console.log("minting the test token...");
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    null, // freeze authority, deliberately absent
    DECIMALS,
  );
  record = { mint: mint.toBase58(), decimals: DECIMALS, signature: "" };
  writeFileSync(mintPath, JSON.stringify(record, null, 2));
  console.log(`created mint     ${record.mint}`);
}

const mintAddress = new PublicKey(record.mint);
const account = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mintAddress,
  payer.publicKey,
);

if (account.amount === 0n) {
  console.log("funding the treasury...");
  const signature = await mintTo(
    connection,
    payer,
    mintAddress,
    account.address,
    payer,
    BigInt(STARTING_FLOAT) * 10n ** BigInt(DECIMALS),
  );
  record.signature = signature;
  writeFileSync(mintPath, JSON.stringify(record, null, 2));
}

const settled = await connection.getTokenAccountBalance(account.address);
const minted = Number(settled.value.amount) / 10 ** DECIMALS;
console.log(`token balance    ${minted.toLocaleString()} (9 decimals, 1 = $1)`);
console.log(`token account    ${account.address.toBase58()}`);
console.log("\nadd to web/.env.local:\n");
console.log(`SOLANA_RPC_URL=${rpcUrl}`);
console.log(`NEXT_PUBLIC_SOLANA_CLUSTER=devnet`);
console.log(`NEXT_PUBLIC_TEST_TOKEN_MINT=${mintAddress}`);
