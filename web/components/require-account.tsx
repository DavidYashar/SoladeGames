"use client";

import { useState, type ReactNode } from "react";

import { RobotMark } from "@/components/brand/arcade-logo";
import { ConnectWallet } from "@/components/connect-wallet";
import { usePlayer } from "@/components/player-provider";
import { USERNAME_MAX, checkUsername, normalizeUsername } from "@/lib/account";

/**
 * Play gate. A wallet must connect AND claim a handle before any cabinet runs.
 * This is the UX layer — the server still refuses writes from unregistered wallets.
 */
export function RequireAccount({
  title,
  children,
}: {
  /** Which cabinet is being gated — used in the copy. */
  title: string;
  children: ReactNode;
}) {
  const { isConnected, player, loading } = usePlayer();

  if (!isConnected) {
    return (
      <Gate title={title}>
        <p className="text-sm leading-relaxed text-zinc-400">
          Connect your wallet to claim a handle. Playing is free — the signature only
          proves the wallet is yours, it costs no gas.
        </p>
        <div className="mt-6 flex justify-center">
          <ConnectWallet />
        </div>
      </Gate>
    );
  }

  if (loading) {
    return (
      <Gate title={title}>
        <p className="font-display text-xs uppercase tracking-[0.2em] text-zinc-500">
          Checking your player card<span className="arcade-cursor">_</span>
        </p>
      </Gate>
    );
  }

  if (!player) {
    return (
      <Gate title={title}>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-400">
          Pick a handle. It is yours for good, and it is what other players see on the
          leaderboard.
        </p>
        <HandleForm />
      </Gate>
    );
  }

  return <>{children}</>;
}

function Gate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pixel-panel rounded-sm p-8 text-center sm:p-10">
      <RobotMark className="mx-auto h-16 w-auto text-white" />
      <p className="font-display mt-5 text-[10px] uppercase tracking-[0.24em] text-[#22e0ff]">
        Player handle required
      </p>
      <h2 className="font-heading mt-3 text-sm leading-relaxed text-white sm:text-base">
        Join to play {title}
      </h2>
      <div className="mt-4">{children}</div>
      <div aria-hidden className="arcade-bar mx-auto mt-7 h-0.5 w-24 opacity-60" />
    </div>
  );
}

function HandleForm() {
  const { register } = usePlayer();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalized = normalizeUsername(raw);
  const check = raw.length > 0 ? checkUsername(raw) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validation = checkUsername(raw);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await register(validation.value);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Registration failed.");
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 w-full max-w-sm text-left">
      <label
        htmlFor="handle"
        className="font-display text-[10px] uppercase tracking-[0.16em] text-zinc-500"
      >
        Your handle
      </label>
      <div className="pixel-well mt-2 flex items-center gap-1 rounded-sm px-3 py-2.5">
        <span className="font-display text-sm text-zinc-500">@</span>
        <input
          id="handle"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError(null);
          }}
          maxLength={USERNAME_MAX + 4}
          autoComplete="off"
          spellCheck={false}
          placeholder="neonking"
          className="font-display w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>

      <div className="mt-1.5 min-h-4">
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : check && !check.ok ? (
          <p className="text-xs text-amber-400">{check.error}</p>
        ) : normalized && normalized !== raw ? (
          <p className="text-xs text-zinc-500">Will be saved as @{normalized}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={busy || !check?.ok}
        className="arcade-btn mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Confirm in wallet…" : "Claim handle"}
      </button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-600">
        3–{USERNAME_MAX} characters · letters, numbers, underscores · lowercase
      </p>
    </form>
  );
}
