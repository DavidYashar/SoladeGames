import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";

/** Arc Testnet RPC endpoint (override with NEXT_PUBLIC_ARC_RPC_URL if needed). */
export const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.io";

/** Arc Testnet chain ID. */
export const ARC_CHAIN_ID = 5042002;

/**
 * USDC ERC-20 interface address on Arc.
 * Native USDC and this ERC-20 share the same balance (6 decimals here, 18 native).
 */
export const USDC_ERC20_ADDRESS =
  "0x3600000000000000000000000000000000000000";

/** USDC token used by the app (override for local anvil E2E with a mock). */
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  USDC_ERC20_ADDRESS) as `0x${string}`;

/** viem ships Arc Testnet as a built-in chain. */
export const arcChain = arcTestnet;

/** HTTP transport for Arc Testnet. */
export const arcTransport = http(ARC_RPC_URL);

/** Shared read-only viem client (used by API routes). */
export const arcPublicClient = createPublicClient({
  chain: arcChain,
  transport: arcTransport,
});
