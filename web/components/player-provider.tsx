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

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

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
  /** Base58 wallet address of the connected player, when there is one. */
  address?: string;
  isConnected: boolean;
  player: PlayerAccount | null;
  /** True while the first account lookup for the current wallet is in flight. */
  loading: boolean;
  isRegistered: boolean;
  /** True when the identity came from the dev stand-in, not a connected wallet. */
  devActive: boolean;
  refresh: () => Promise<void>;
  register: (rawUsername: string) => Promise<RegisterOutcome>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/**
 * Owns "which player is this wallet". The header, the play gate and the profile all
 * read from here so a fresh registration is reflected everywhere at once.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, signMessage } = useWallet();

  const address = publicKey?.toBase58();

  const [player, setPlayer] = useState<PlayerAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupFor, setLookupFor] = useState<string | null>(null);
  const [devPlayer, setDevPlayer] = useState<PlayerAccount | null>(null);

  // Dev stand-in: `/api/dev/player` only answers under `next dev`, so this effect is
  // inert in a production build and the gate behaves exactly as it always did.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO === "1") return;
    if (connected) {
      setDevPlayer(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/dev/player", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { player?: PlayerAccount };
        if (!cancelled) setDevPlayer(data.player ?? null);
      } catch {
        // No dev route reachable: fall through to the real gate.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected]);

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
      if (!signMessage) {
        return { ok: false, error: "This wallet cannot sign messages." };
      }

      // Normalise exactly the way the server does before signing.
      const username = normalizeUsername(rawUsername);
      const issuedAt = new Date().toISOString();
      const message = buildRegisterMessage(username, issuedAt);

      let signature: string;
      try {
        const bytes = await signMessage(new TextEncoder().encode(message));
        signature = bs58.encode(bytes);
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
    [address, signMessage],
  );

  const devActive = devPlayer !== null && !connected;

  const value = useMemo<PlayerContextValue>(
    () => ({
      address: address ?? devPlayer?.address,
      isConnected: connected || devActive,
      player: player ?? devPlayer,
      // Only "loading" once we know which wallet we are waiting on.
      loading: Boolean(address) && (loading || lookupFor !== address),
      isRegistered: Boolean(player ?? devPlayer),
      devActive,
      refresh,
      register,
    }),
    [
      address,
      connected,
      devActive,
      player,
      devPlayer,
      loading,
      lookupFor,
      refresh,
      register,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {devActive ? <DevRibbon /> : null}
    </PlayerContext.Provider>
  );
}

/** Marks a screenshotted build as the dev stand-in, so no capture reads as signed in. */
function DevRibbon() {
  return (
    <div
      role="status"
      className="font-display fixed bottom-3 right-3 z-50 border border-amber-400/70 bg-black/90 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-300"
    >
      Dev player · no wallet
    </div>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
