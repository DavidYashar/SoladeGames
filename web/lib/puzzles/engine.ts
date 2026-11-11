import { hashSeed } from "./rng";
import { getDailySequence, verifySequenceAnswer } from "./sequence";
import { getDaily24, verify24Answer } from "./twenty-four";
import type { DailyPuzzle, PuzzleType, VerifyResult } from "./types";
import { getDailyWord, verifyWordAnswer } from "./word-scramble";

const TYPES = ["word", "math24", "sequence"] as const;

const META: Record<
  PuzzleType,
  { title: string; blurb: string; attemptsAllowed: number }
> = {
  word: {
    title: "Daily Anagram",
    blurb: "Unscramble the letters to find today's word.",
    attemptsAllowed: 5,
  },
  math24: {
    title: "Make 24",
    blurb: "Use each number exactly once with + − × ÷ to make 24.",
    attemptsAllowed: 10,
  },
  sequence: {
    title: "What Comes Next?",
    blurb: "Spot the pattern and give the next number.",
    attemptsAllowed: 3,
  },
};

function puzzleType(date: string): PuzzleType {
  return TYPES[hashSeed(`${date}:type`) % TYPES.length];
}

interface Resolved {
  data: DailyPuzzle["data"];
  answer: string;
  check: (guess: string) => boolean;
}

/** Internal resolution: puzzle data + answer + checker for a given date. */
function resolve(date: string): Resolved {
  const type = puzzleType(date);
  switch (type) {
    case "word": {
      const { data, answer } = getDailyWord(date);
      return { data, answer, check: (g) => verifyWordAnswer(answer, g) };
    }
    case "math24": {
      const { data, answer } = getDaily24(date);
      return { data, answer, check: (g) => verify24Answer(data.numbers, g) };
    }
    case "sequence": {
      const { data, answer } = getDailySequence(date);
      return { data, answer, check: (g) => verifySequenceAnswer(answer, g) };
    }
  }
}

/** Public puzzle for a date — contains no answer material. */
export function getDailyPuzzle(date: string): DailyPuzzle {
  const type = puzzleType(date);
  const { data } = resolve(date);
  return { date, type, ...META[type], data };
}

/** Stateless server-side verification. Answers never ship to the client. */
export function verifyPuzzle(
  date: string,
  answer: string | null,
  reveal: boolean,
): VerifyResult {
  const { answer: solution, check } = resolve(date);

  if (reveal) {
    return {
      correct: false,
      message: "Answer revealed.",
      revealAnswer: solution,
    };
  }

  const guess = (answer ?? "").trim();
  if (!guess) {
    return { correct: false, message: "Enter an answer first." };
  }
  if (check(guess)) {
    return { correct: true, message: "Correct! 🎉", answer: solution };
  }
  return { correct: false, message: "Not quite — try again." };
}
