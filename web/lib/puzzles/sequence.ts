import { createDailyRng } from "./rng";
import type { PuzzleData } from "./types";

export interface SequenceResult {
  data: Extract<PuzzleData, { kind: "sequence" }>;
  answer: string;
  rule: string;
}

type Rule = "arithmetic" | "geometric" | "fibonacci" | "squares" | "cubes";

const RULES: readonly Rule[] = [
  "arithmetic",
  "geometric",
  "fibonacci",
  "squares",
  "cubes",
];

/** Deterministic "what comes next" number sequence. */
export function getDailySequence(dateKey: string): SequenceResult {
  const rng = createDailyRng(dateKey, "sequence");
  const rule = RULES[Math.floor(rng() * RULES.length)];
  let terms: number[] = [];
  let answer = 0;
  let hint = "";
  let ruleName = rule;

  switch (rule) {
    case "arithmetic": {
      const start = 2 + Math.floor(rng() * 9);
      const step = 1 + Math.floor(rng() * 6);
      terms = Array.from({ length: 5 }, (_, i) => start + i * step);
      answer = start + 5 * step;
      hint = "Each number is the previous one plus a constant.";
      break;
    }
    case "geometric": {
      const start = 1 + Math.floor(rng() * 4);
      const ratio = 2 + Math.floor(rng() * 2);
      terms = Array.from({ length: 5 }, (_, i) => start * ratio ** i);
      answer = start * ratio ** 5;
      hint = "Each number is the previous one times a constant.";
      break;
    }
    case "fibonacci": {
      let a = 1 + Math.floor(rng() * 4);
      let b = a + 1 + Math.floor(rng() * 4);
      terms = [a, b];
      for (let i = 0; i < 3; i++) {
        const c = a + b;
        terms.push(c);
        a = b;
        b = c;
      }
      answer = a + b;
      hint = "Each number is the sum of the two before it.";
      break;
    }
    case "squares": {
      const k = 2 + Math.floor(rng() * 4);
      terms = Array.from({ length: 5 }, (_, i) => (k + i) ** 2);
      answer = (k + 5) ** 2;
      hint = "Perfect squares, in order.";
      break;
    }
    case "cubes": {
      const k = 1 + Math.floor(rng() * 3);
      terms = Array.from({ length: 5 }, (_, i) => (k + i) ** 3);
      answer = (k + 5) ** 3;
      hint = "Perfect cubes, in order.";
      break;
    }
    default: {
      // Unreachable with the fixed RULES tuple.
      throw new Error(`Unknown sequence rule: ${String(rule)}`);
    }
  }

  return {
    data: { kind: "sequence", terms, hint },
    answer: String(answer),
    rule: ruleName,
  };
}

export function verifySequenceAnswer(answer: string, guess: string): boolean {
  return guess.trim() === answer;
}
