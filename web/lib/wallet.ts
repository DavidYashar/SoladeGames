/** Clear any persisted wallet-connection cache so the next connect forces a fresh sign-in. */
export function clearWalletCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("wagmi")) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}
