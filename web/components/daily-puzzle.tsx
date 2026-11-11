"use client";

import { useEffect, useState } from "react";

import { useStats } from "@/hooks/use-stats";
import type { DailyPuzzle, VerifyResult } from "@/lib/puzzles/types";

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface SolvedInfo {
  timeMs: number;
  attempts: number;
}

/** Interactive daily puzzle: fetch → guess → verify → score card. */
export function DailyPuzzle() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [solvedInfo, setSolvedInfo] = useState<SolvedInfo | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const stats = useStats();

  useEffect(() => {
    let cancelled = false;
    async function loadPuzzle() {
      try {
        const res = await fetch("/api/puzzles/daily");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DailyPuzzle;
        if (!cancelled) setPuzzle(data);
      } catch {
        if (!cancelled) setError("Couldn't load today's puzzle. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPuzzle();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (solvedInfo || revealed) return;
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [solvedInfo, revealed, startTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puzzle || solvedInfo || revealed || busy || !answer.trim()) return;

    setBusy(true);
    try {
      const res = await fetch("/api/puzzles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: puzzle.date, answer: answer.trim() }),
      });
      const data = (await res.json()) as VerifyResult;
      if (data.correct) {
        const timeMs = Date.now() - startTime;
        const used = attempts + 1;
        setSolvedInfo({ timeMs, attempts: used });
        stats.recordSolve(puzzle.date, timeMs, used);
        setMessage(data.message);
      } else {
        const used = attempts + 1;
        setAttempts(used);
        setMessage(
          used >= puzzle.attemptsAllowed
            ? "Out of attempts — reveal the answer or come back tomorrow."
            : `${data.message} (${puzzle.attemptsAllowed - used} left)`,
        );
      }
    } catch {
      setMessage("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReveal() {
    if (!puzzle || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/puzzles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: puzzle.date, reveal: true }),
      });
      const data = (await res.json()) as VerifyResult;
      setRevealed(true);
      setRevealAnswer(data.revealAnswer ?? "—");
      setMessage("Answer revealed.");
    } catch {
      setMessage("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyShare() {
    if (!solvedInfo) return;
    const text = `I solved today's I-market Games ${puzzle?.title ?? "puzzle"} in ${formatTime(
      solvedInfo.timeMs,
    )} with ${solvedInfo.attempts} attempt${solvedInfo.attempts === 1 ? "" : "s"} — streak ${stats.currentStreak} 🔥 Play Arkade on Solana.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  }

  if (loading) {
    return (
      <p className="font-display py-10 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
        Loading today&apos;s puzzle<span className="arcade-cursor">_</span>
      </p>
    );
  }
  if (error || !puzzle) {
    return (
      <p className="pixel-panel rounded-sm p-4 text-center text-sm text-red-400">
        {error}
      </p>
    );
  }

  const data = puzzle.data;
  const done = Boolean(solvedInfo);
  const canSubmit = !done && !revealed && attempts < puzzle.attemptsAllowed;

  return (
    <div className="flex flex-col gap-6">
      {/* Puzzle cabinet */}
      <div className="pixel-panel rounded-sm">
        <div className="flex items-center justify-between gap-3 border-b-2 border-black/70 bg-white/[0.03] px-5 py-3">
          <h2 className="font-heading text-[11px] uppercase leading-relaxed text-white sm:text-xs">
            {puzzle.title}
          </h2>
          <span className="font-display shrink-0 text-[9px] uppercase tracking-[0.16em] text-zinc-500">
            {puzzle.date}
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-zinc-400">{puzzle.blurb}</p>

          {data.kind === "word" && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {data.scrambled.split("").map((ch, i) => (
                <span
                  key={`${i}-${ch}`}
                  className="pixel-well font-heading flex h-14 w-11 items-center justify-center rounded-sm text-sm text-[#22e0ff]"
                >
                  {ch}
                </span>
              ))}
            </div>
          )}

          {data.kind === "math24" && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {data.numbers.map((n, i) => (
                <span
                  key={i}
                  className="pixel-well font-heading flex h-14 w-11 items-center justify-center rounded-sm text-sm text-emerald-300"
                >
                  {n}
                </span>
              ))}
              <span className="font-display flex h-14 items-center px-2 text-xl text-zinc-600">
                =
              </span>
              <span className="pixel-well font-heading flex h-14 w-11 items-center justify-center rounded-sm text-sm text-emerald-300">
                {data.target}
              </span>
            </div>
          )}

          {data.kind === "sequence" && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {data.terms.map((n, i) => (
                <span
                  key={i}
                  className="pixel-well font-heading flex h-14 min-w-11 items-center justify-center rounded-sm px-2 text-xs text-amber-300"
                >
                  {n}
                </span>
              ))}
              <span className="pixel-well font-heading flex h-14 min-w-11 items-center justify-center rounded-sm border-dashed px-2 text-xs text-zinc-500">
                ?
              </span>
            </div>
          )}

          <p className="mt-4 text-center text-xs leading-relaxed text-zinc-500">
            💡 {data.hint}
          </p>

          {canSubmit && (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                inputMode={data.kind === "math24" ? "text" : "numeric"}
                placeholder={
                  data.kind === "word"
                    ? "Your word"
                    : data.kind === "math24"
                      ? "e.g. (6*3)+8-2"
                      : "Next number"
                }
                className="pixel-well font-display flex-1 rounded-sm px-4 py-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#22e0ff]"
                autoFocus
              />
              <button
                type="submit"
                disabled={busy}
                className="arcade-btn disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "…" : "Submit"}
              </button>
            </form>
          )}

          {/* Attempt pips — square, like cabinet lamps */}
          <div className="mt-5 flex items-center justify-center gap-2">
            {Array.from({ length: puzzle.attemptsAllowed }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 border ${
                  i < attempts
                    ? "border-red-500 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                    : "border-zinc-700 bg-zinc-800"
                }`}
              />
            ))}
          </div>

          {message && !done && (
            <p className="mt-3 text-center text-sm leading-relaxed text-zinc-300">
              {message}
            </p>
          )}

          {attempts >= puzzle.attemptsAllowed && !done && !revealed && (
            <div className="mt-4 text-center">
              <button
                onClick={handleReveal}
                disabled={busy}
                className="arcade-btn-ghost !px-4 !py-2 !text-[11px]"
              >
                Reveal answer
              </button>
            </div>
          )}

          {revealed && (
            <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">
              Today&apos;s answer:{" "}
              <span className="font-display text-amber-300">{revealAnswer}</span>
              <br />
              <span className="text-xs">Come back tomorrow for a fresh puzzle!</span>
            </p>
          )}
        </div>
      </div>

      {/* Result card */}
      {done && solvedInfo && (
        <div className="pixel-panel rounded-sm">
          <div className="border-b-2 border-black/70 bg-emerald-500/10 px-5 py-3 text-center">
            <h3 className="font-heading text-[11px] uppercase leading-relaxed text-emerald-300">
              {message ?? "Solved!"}
            </h3>
          </div>
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="pixel-well rounded-sm p-3 text-center">
                <p className="font-display text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                  Time
                </p>
                <p className="font-heading mt-2 text-sm text-zinc-100">
                  {formatTime(solvedInfo.timeMs)}
                </p>
              </div>
              <div className="pixel-well rounded-sm p-3 text-center">
                <p className="font-display text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                  Attempts
                </p>
                <p className="font-heading mt-2 text-sm text-zinc-100">
                  {solvedInfo.attempts}/{puzzle.attemptsAllowed}
                </p>
              </div>
              <div className="pixel-well rounded-sm p-3 text-center">
                <p className="font-display text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                  Streak
                </p>
                <p className="font-heading mt-2 text-sm text-zinc-100">
                  {stats.currentStreak}
                </p>
              </div>
            </div>
            <div className="font-display mt-4 flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.1em] text-zinc-500">
              <span>Solved {stats.totalSolved}</span>
              <span className="text-zinc-700">|</span>
              <span>Best streak {stats.bestStreak}</span>
            </div>
            <div className="mt-5 flex justify-center">
              <button onClick={copyShare} className="arcade-btn-ghost !px-5 !py-2.5 !text-[11px]">
                {copied ? "Copied!" : "Copy share card"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!done && (
        <p className="font-display text-center text-[10px] uppercase leading-relaxed tracking-[0.12em] text-zinc-600">
          {formatTime(elapsed * 1000)}
          {" · "}
          Free mode: streaks save locally.
        </p>
      )}
    </div>
  );
}
