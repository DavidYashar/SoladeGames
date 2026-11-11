import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Server-side paid-league ledger (attempts + winner list), persisted as JSON.
 * MVP storage — swap for a DB before mainnet volume.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "leagues.json");

interface TierData {
  attempts: Record<string, number>;
  solves: string[];
}

type Store = Record<string, Record<string, TierData>>;

function load(): Store {
  try {
    if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch {
    // Corrupt file — start fresh.
  }
  return {};
}

function save(store: Store): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2));
}

export function getAttempts(date: string, tier: number, address: string): number {
  return load()[date]?.[String(tier)]?.attempts[address] ?? 0;
}

export function recordAttempt(date: string, tier: number, address: string): number {
  const store = load();
  const day = (store[date] ??= {});
  const t = (day[String(tier)] ??= { attempts: {}, solves: [] });
  t.attempts[address] = (t.attempts[address] ?? 0) + 1;
  save(store);
  return t.attempts[address];
}

export function recordSolve(date: string, tier: number, address: string): void {
  const store = load();
  const day = (store[date] ??= {});
  const t = (day[String(tier)] ??= { attempts: {}, solves: [] });
  if (!t.solves.includes(address)) t.solves.push(address);
  save(store);
}

export function getSolves(date: string, tier: number): string[] {
  return load()[date]?.[String(tier)]?.solves ?? [];
}
