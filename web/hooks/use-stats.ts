"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "imarket-games:stats:v1";
const DAY_MS = 86_400_000;

export interface SolveRecord {
  timeMs: number;
  attempts: number;
}

export interface GameStats {
  solved: Record<string, SolveRecord>;
}

function dateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function load(): GameStats {
  if (typeof window === "undefined") return { solved: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as GameStats;
  } catch {
    // Corrupt storage — start fresh.
  }
  return { solved: {} };
}

function currentStreak(solved: Record<string, SolveRecord>): number {
  const today = new Date();
  const cursor = new Date(
    solved[dateKey(today)] ? today.getTime() : today.getTime() - DAY_MS,
  );
  let streak = 0;
  while (solved[dateKey(new Date(cursor))]) {
    streak++;
    cursor.setTime(cursor.getTime() - DAY_MS);
  }
  return streak;
}

function bestStreak(solved: Record<string, SolveRecord>): number {
  const dates = Object.keys(solved).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev !== null && Date.parse(d) - Date.parse(prev) === DAY_MS ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

/** Free-mode progress stored locally (score card + streaks). */
export function useStats() {
  const [stats, setStats] = useState<GameStats>(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // Storage unavailable (private mode) — stats live in memory only.
    }
  }, [stats]);

  const recordSolve = useCallback(
    (date: string, timeMs: number, attempts: number) => {
      setStats((s) => ({
        solved: { ...s.solved, [date]: { timeMs, attempts } },
      }));
    },
    [],
  );

  const solvedToday = Boolean(stats.solved[dateKey()]);
  const totalSolved = Object.keys(stats.solved).length;

  return {
    stats,
    recordSolve,
    solvedToday,
    totalSolved,
    currentStreak: currentStreak(stats.solved),
    bestStreak: bestStreak(stats.solved),
  };
}
