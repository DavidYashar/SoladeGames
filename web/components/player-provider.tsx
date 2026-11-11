"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAccount, useSignMessage } from "wagmi";

import {
  buildRegisterMessage,
  normalizeUsername,
  type PlayerAccount,
} from "@/lib/account";

export interface RegisterOutcome {
  ok: boolean;
  error?: string;
}

interface PlayerContextValue {
  address?: `0x${string}`;
  isConnected: boolean;
  player: PlayerAccount | null;
  /** True while the first account lookup for the current wallet is in flight. */
  loading: boolean;
  isRegistered: boolean;
  refresh: () => Promise<void>;
  register: (rawUsername: string) => Promise<RegisterOutcome>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/**
 * Owns "which player is this wallet". The header, the play gate and the profile all
 * read from here so a fresh registration is reflected everywhere at once.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [player, setPlayer] = useState<PlayerAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupFor, setLookupFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setPlayer(null);
      setLookupFor(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/account/${address}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { player?: PlayerAccount };
        setPlayer(data.player ?? null);
      } else {
        setPlayer(null);
      }
    } catch {
      setPlayer(null);
    } finally {
      setLookupFor(address);
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const register = useCallback(
    async (rawUsername: string): Promise<RegisterOutcome> => {
      if (!address) return { ok: false, error: "Connect a wallet first." };

      // Normalise exactly the way the server does before signing.
      const username = normalizeUsername(rawUsername);
      const issuedAt = new Date().toISOString();

      let signature: `0x${string}`;
      try {
        signature = await signMessageAsync({
          message: buildRegisterMessage(username, issuedAt),
        });
      } catch (err) {
        const rejected = err instanceof Error && /reject|denied|cancel/i.test(err.message);
        return { ok: false, error: rejected ? "Signature cancelled." : "Could not sign." };
      }

      try {
        const res = await fetch("/api/account/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, username, signature, issuedAt }),
        });
        const data = (await res.json()) as { player?: PlayerAccount; error?: string };
        if (!res.ok) {
          return { ok: false, error: data.error ?? "Registration failed." };
        }
        setPlayer(data.player ?? null);
        setLookupFor(address);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — please try again." };
      }
    },
    [address, signMessageAsync],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      address,
      isConnected,
      player,
      // Only "loading" once we know which wallet we are waiting on.
      loading: Boolean(address) && (loading || lookupFor !== address),
      isRegistered: Boolean(player),
      refresh,
      register,
    }),
    [address, isConnected, player, loading, lookupFor, refresh, register],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
