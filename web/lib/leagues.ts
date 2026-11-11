import { formatUnits } from "viem";

import { USDC_ADDRESS } from "./arc";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** PuzzleLeague contract address. Set NEXT_PUBLIC_LEAGUE_ADDRESS after deploy. */
export const LEAGUE_ADDRESS = (process.env.NEXT_PUBLIC_LEAGUE_ADDRESS ??
  ZERO_ADDRESS) as `0x${string}`;

export const leagueDeployed =
  LEAGUE_ADDRESS !== ZERO_ADDRESS && LEAGUE_ADDRESS.length === 42;

export { USDC_ADDRESS };

export const LEAGUE_ABI = [
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
    name: "claim",
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
    name: "pot",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
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
    name: "prizeOf",
    stateMutability: "view",
    inputs: [
      { name: "player", type: "address" },
      { name: "day", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const USDC_ABI = [
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
] as const;

/** League tiers. Fees in 6-decimal USDC units. */
export const TIERS = [
  { id: 0, name: "Copper", fee: "0.10", feeUnits: 100_000n },
  { id: 1, name: "Silver", fee: "0.50", feeUnits: 500_000n },
  { id: 2, name: "Gold", fee: "1.00", feeUnits: 1_000_000n },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export interface TierStatus {
  id: TierId;
  name: string;
  fee: string;
  feeUnits: string;
  potUnits: string;
  entries: number;
  settled: boolean;
  youEntered: boolean;
  youClaimUnits: string;
  attemptsUsed: number;
  solved: boolean;
}

export interface LeagueStatus {
  date: string;
  day: string;
  contractDeployed: boolean;
  error?: string;
  usdcBalanceUnits: string;
  usdcAllowanceUnits: string;
  tiers: TierStatus[];
  enteredTier: TierId | null;
  solvedTier: TierId | null;
}

export interface PaidVerifyResult {
  correct: boolean;
  solved?: boolean;
  message?: string;
  attemptsUsed?: number;
}

/** League "day" = UTC epoch day, matching the puzzle date. */
export function leagueDay(date: string): bigint {
  return BigInt(Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000));
}

/** Message the player signs to prove wallet ownership for paid verification. */
export function buildSolveMessage(date: string, tier: TierId): string {
  const name = TIERS[tier]?.name ?? String(tier);
  return `I-market Games\nVerify a league solve\n\nDate: ${date}\nTier: ${name}`;
}

export function formatUsdc(units: string | bigint): string {
  return formatUnits(BigInt(units), 6);
}
