import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

/**
 * Solana cluster configuration. Devnet until we say otherwise; nothing here
 * touches a private key, so it is safe in the client bundle.
 */

export type SolanaCluster = "devnet" | "testnet" | "mainnet-beta";

export const SOLANA_CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ??
  "devnet") as SolanaCluster;

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  clusterApiUrl(SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : SOLANA_CLUSTER);

/** Shared read connection. Confirmed commitment: fast enough for a UI. */
export const solanaConnection = new Connection(SOLANA_RPC_URL, "confirmed");

/** Arkade's test currency, minted by `npm run solana:devnet`. */
export const ARKADE_MINT = process.env.NEXT_PUBLIC_TEST_TOKEN_MINT ?? "";

/**
 * A Solana address is base58 that round-trips through PublicKey. The round trip
 * matters: PublicKey accepts several encodings, and we only want the canonical one.
 */
export function isSolanaAddress(value: string): boolean {
  if (!value || value.length < 32 || value.length > 44) return false;
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

export function explorerUrl(address: string, suffix = ""): string {
  return `https://explorer.solana.com/address/${address}?cluster=${SOLANA_CLUSTER}${suffix}`;
}
