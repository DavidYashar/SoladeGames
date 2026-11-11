import { createDailyRng, pickIndex, shuffle } from "./rng";
import type { PuzzleData } from "./types";
import { WORDS } from "./words";

export interface WordResult {
  data: Extract<PuzzleData, { kind: "word" }>;
  answer: string;
}

function scramble(word: string, rng: () => number): string {
  return shuffle(word.split(""), rng).join("");
}

/** Deterministic daily anagram. */
export function getDailyWord(dateKey: string): WordResult {
  const rng = createDailyRng(dateKey, "word");
  const word = WORDS[pickIndex(rng, WORDS.length)].toLowerCase();

  // Never present the word unscrambled.
  let scrambled = scramble(word, rng);
  let guard = 0;
  while (scrambled === word && guard++ < 20) {
    scrambled = scramble(word, rng);
  }

  return {
    data: {
      kind: "word",
      scrambled: scrambled.toUpperCase(),
      length: word.length,
      hint: `A ${word.length}-letter word, starting with "${word[0].toUpperCase()}".`,
    },
    answer: word,
  };
}

/** Case/whitespace-insensitive comparison. */
export function verifyWordAnswer(answer: string, guess: string): boolean {
  return guess.trim().toLowerCase() === answer;
}
