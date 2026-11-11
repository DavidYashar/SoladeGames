#!/usr/bin/env node
/**
 * End-to-end paid-league test against a local anvil + dev server.
 * Deploys nothing; expects MockUSDC + PuzzleLeague already on the RPC.
 *
 * Setup:
 *   anvil
 *   forge create MockUSDC  --rpc-url http://localhost:8545 --private-key <anvil key0> --broadcast
 *   forge create PuzzleLeague --rpc-url ... --broadcast --constructor-args <usdc> <holder> <platform>
 *   cast send <usdc> "mint(address,uint256)" <player> 1000000000 --private-key <anvil key0>
 *
 * Env:
 *   ARC_RPC_URL    default http://localhost:8545
 *   LEAGUE_ADDRESS PuzzleLeague address
 *   USDC_ADDRESS   MockUSDC address
 *   API_URL        default http://localhost:3000 (dev server with
 *                  NEXT_PUBLIC_LEAGUE_ADDRESS + NEXT_PUBLIC_USDC_ADDRESS set)
 *   PLAYER_PK      player private key
 *   OWNER_PK       optional owner key — if set, settles + claims too
 */
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const rpc = process.env.ARC_RPC_URL ?? "http://localhost:8545";
const league = process.env.LEAGUE_ADDRESS;
const usdc = process.env.USDC_ADDRESS;
const api = process.env.API_URL ?? "http://localhost:3000";
const pk = process.env.PLAYER_PK;
if (!league || !usdc || !pk) {
  console.error("Set LEAGUE_ADDRESS, USDC_ADDRESS, and PLAYER_PK.");
  process.exit(1);
}

const account = privateKeyToAccount(pk);
const player = account.address;
const chain = arcTestnet;
const publicClient = createPublicClient({ chain, transport: http(rpc) });
const walletClient = createWalletClient({ chain, transport: http(rpc), account });

const USDC_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

const LEAGUE_ABI = [
  {
    type: "function",
    name: "enter",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "entered",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
      { name: "player", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
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
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [],
  },
];

const date = new Date().toISOString().slice(0, 10);
const day = BigInt(Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000));
const tier = 0;
const fee = 100_000n;

// 1. Approve + enter.
let allowance = await publicClient.readContract({
  address: usdc,
  abi: USDC_ABI,
  functionName: "allowance",
  args: [player, league],
});
if (allowance < fee) {
  console.log("approving USDC…");
  await walletClient.writeContract({
    address: usdc,
    abi: USDC_ABI,
    functionName: "approve",
    args: [league, fee],
  });
}
console.log("entering league…");
await walletClient.writeContract({
  address: league,
  abi: LEAGUE_ABI,
  functionName: "enter",
  args: [day, tier],
});
console.log(
  "entered:",
  await publicClient.readContract({
    address: league,
    abi: LEAGUE_ABI,
    functionName: "entered",
    args: [day, tier, player],
  }),
);

// 2. Sign + verify a wrong answer, then the right one.
const msg = `I-market Games\nVerify a league solve\n\nDate: ${date}\nTier: Copper`;
const signature = await walletClient.signMessage({ message: msg });

async function post(body) {
  const res = await fetch(`${api}/api/leagues/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

console.log("wrong answer →", await post({ date, tier, address: player, signature, answer: "0" }));

const reveal = await fetch(`${api}/api/puzzles/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ date, reveal: true }),
}).then((r) => r.json());
console.log("revealed answer:", reveal.revealAnswer);

console.log(
  "correct answer →",
  await post({ date, tier, address: player, signature, answer: reveal.revealAnswer }),
);

// 3. Status includes the solve.
const q = new URLSearchParams({ address: player });
const status = await fetch(`${api}/api/leagues/status?${q}`).then((r) => r.json());
console.log("status:", JSON.stringify(status, null, 2));

// 4. Optional: owner settles + player claims.
const ownerPk = process.env.OWNER_PK;
if (ownerPk) {
  const owner = privateKeyToAccount(ownerPk);
  const ownerClient = createWalletClient({ chain, transport: http(rpc), account: owner });
  console.log("owner settling…");
  await ownerClient.writeContract({
    address: league,
    abi: LEAGUE_ABI,
    functionName: "settle",
    args: [day, tier, [player]],
  });
  console.log(
    "settled:",
    await publicClient.readContract({
      address: league,
      abi: LEAGUE_ABI,
      functionName: "settled",
      args: [day, tier],
    }),
  );
  console.log("player claiming…");
  await walletClient.writeContract({
    address: league,
    abi: LEAGUE_ABI,
    functionName: "claim",
    args: [day, tier],
  });
  console.log(
    "player USDC balance:",
    (
      await publicClient.readContract({
        address: usdc,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [player],
      })
    ).toString(),
  );
}

console.log("E2E complete.");
