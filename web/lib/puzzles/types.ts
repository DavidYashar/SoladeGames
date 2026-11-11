/** Shared puzzle types used by the engine, API routes, and UI. */

export type PuzzleType = "word" | "math24" | "sequence";

export type PuzzleData =
  | { kind: "word"; scrambled: string; length: number; hint: string }
  | { kind: "math24"; numbers: number[]; target: number; hint: string }
  | { kind: "sequence"; terms: number[]; hint: string };

/** Public view of the daily puzzle — never contains answers. */
export interface DailyPuzzle {
  date: string;
  type: PuzzleType;
  title: string;
  blurb: string;
  attemptsAllowed: number;
  data: PuzzleData;
}

export interface VerifyResult {
  correct: boolean;
  message: string;
  /** Set when the answer is correct. */
  answer?: string;
  /** Set when an explicit reveal was requested (free mode). */
  revealAnswer?: string;
}
