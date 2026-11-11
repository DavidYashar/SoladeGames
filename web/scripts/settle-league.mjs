#!/usr/bin/env node
/**
 * Settle a paid league day+tier on-chain using the server's winner ledger.
 *
 * Usage:
 *   node scripts/settle-league.mjs <YYYY-MM-DD> <tier 0|1|2> [--execute]
 *
 * Env:
 *   PRIVATE_KEY      owner account private key (deployer of PuzzleLeague)
 *   LEAGUE_ADDRESS   PuzzleLeague contract address
 *   ARC_RPC_URL      optional, defaults to https://rpc.testnet.arc.io
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const [date, tierStr, flag] = process.argv.slice(2);
const execute = flag === "--execute";
const tier = Number(tierStr);

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || ![0, 1, 2].includes(tier)) {
  console.error(
    "Usage: node scripts/settle-league.mjs <YYYY-MM-DD> <tier 0|1|2> [--execute]",
  );
  process.exit(1);
}

const rpc = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.io";
const leagueAddress = process.env.LEAGUE_ADDRESS;
const pk = process.env.PRIVATE_KEY;
if (!leagueAddress || !pk) {
  console.error("Set LEAGUE_ADDRESS and PRIVATE_KEY (owner).");
  process.exit(1);
}

const ABI = [
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
      { name: "winners", type: "address[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settled",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "entries",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const day = BigInt(Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000));
const file = path.join(process.cwd(), "data", "leagues.json");
const store = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : {};
const solves = store[date]?.[String(tier)]?.solves ?? [];

console.log(`Day ${day} (${date}) · tier ${tier} · ${solves.length} winner(s)`);

const chain = arcTestnet;
const publicClient = createPublicClient({ chain, transport: http(rpc) });

const settled = await publicClient.readContract({
  address: leagueAddress,
  abi: ABI,
  functionName: "settled",
  args: [day, tier],
});
if (settled) {
  console.log("Already settled on-chain.");
  process.exit(0);
}

const entries = await publicClient.readContract({
  address: leagueAddress,
  abi: ABI,
  functionName: "entries",
  args: [day, tier],
});
if (solves.length === 0) {
  console.log(`No winners recorded and ${entries} entries on-chain — nothing to settle.`);
  process.exit(0);
}

if (!execute) {
  console.log("DRY RUN — would settle with:", solves.join(", "));
  console.log("Re-run with --execute to send the transaction.");
  process.exit(0);
}

const account = privateKeyToAccount(pk);
const walletClient = createWalletClient({ chain, transport: http(rpc), account });
const hash = await walletClient.writeContract({
  address: leagueAddress,
  abi: ABI,
  functionName: "settle",
  args: [day, tier, solves],
});
console.log("Settle tx:", hash);
