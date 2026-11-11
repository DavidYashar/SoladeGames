import { createDailyRng } from "./rng";
import type { PuzzleData } from "./types";

/** Exact rational arithmetic so expression evaluation is precise. */
type Rat = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function rat(n: number, d = 1): Rat {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

const add = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
const div = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);

export interface Math24Result {
  data: Extract<PuzzleData, { kind: "math24" }>;
  answer: string;
}

/** Exhaustive solver: can these four numbers reach 24? Returns an
 *  expression string if so. */
function solve(vals: { r: Rat; e: string }[]): string | null {
  if (vals.length === 1) {
    return vals[0].r.n === 24 && vals[0].r.d === 1 ? vals[0].e : null;
  }
  for (let i = 0; i < vals.length; i++) {
    for (let j = i + 1; j < vals.length; j++) {
      const rest = vals.filter((_, k) => k !== i && k !== j);
      const a = vals[i];
      const b = vals[j];
      const cands = [
        { r: add(a.r, b.r), e: `(${a.e}+${b.e})` },
        { r: sub(a.r, b.r), e: `(${a.e}-${b.e})` },
        { r: sub(b.r, a.r), e: `(${b.e}-${a.e})` },
        { r: mul(a.r, b.r), e: `(${a.e}*${b.e})` },
      ];
      if (b.r.n !== 0) cands.push({ r: div(a.r, b.r), e: `(${a.e}/${b.e})` });
      if (a.r.n !== 0) cands.push({ r: div(b.r, a.r), e: `(${b.e}/${a.e})` });
      for (const c of cands) {
        const sol = solve([...rest, c]);
        if (sol) return sol;
      }
    }
  }
  return null;
}

/** Deterministic "Make 24" — four digits, always solvable. */
export function getDaily24(dateKey: string): Math24Result {
  const rng = createDailyRng(dateKey, "math24");
  for (let attempt = 0; attempt < 60; attempt++) {
    const numbers = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 9));
    const solution = solve(
      numbers.map((n) => ({ r: rat(n), e: String(n) })),
    );
    if (solution) {
      return {
        data: {
          kind: "math24",
          numbers,
          target: 24,
          hint: "Use each number exactly once, with + − × ÷ and parentheses.",
        },
        answer: solution,
      };
    }
  }
  // Fallback guaranteed-solvable set (extremely unlikely to be reached).
  return {
    data: {
      kind: "math24",
      numbers: [6, 3, 8, 2],
      target: 24,
      hint: "Use each number exactly once, with + − × ÷ and parentheses.",
    },
    answer: "((6*3)+8)-2",
  };
}

/* ---------- expression verification ---------- */

function tokenize(expr: string): string[] | null {
  const s = expr.replace(/\s+/g, "");
  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9]/.test(c)) {
      let num = "";
      while (i < s.length && /[0-9]/.test(s[i])) {
        num += s[i];
        i++;
      }
      tokens.push(num);
    } else if ("+-*/()".includes(c)) {
      tokens.push(c);
      i++;
    } else {
      return null; // illegal character
    }
  }
  return tokens;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

function toRpn(tokens: string[]): string[] | null {
  const out: string[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (/^[0-9]+$/.test(t)) {
      out.push(t);
    } else if (t === "(") {
      ops.push(t);
    } else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") {
        out.push(ops.pop()!);
      }
      if (!ops.length) return null; // unbalanced
      ops.pop();
    } else {
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        PREC[ops[ops.length - 1]] >= PREC[t]
      ) {
        out.push(ops.pop()!);
      }
      ops.push(t);
    }
  }
  while (ops.length) {
    const o = ops.pop()!;
    if (o === "(") return null; // unbalanced
    out.push(o);
  }
  return out;
}

function evalRpn(tokens: string[]): Rat | null {
  const st: Rat[] = [];
  for (const t of tokens) {
    if (/^[0-9]+$/.test(t)) {
      st.push(rat(parseInt(t, 10)));
    } else {
      if (st.length < 2) return null;
      const b = st.pop()!;
      const a = st.pop()!;
      if (t === "/" && b.n === 0) return null; // division by zero
      const op = { "+": add, "-": sub, "*": mul, "/": div }[t];
      if (!op) return null;
      st.push(op(a, b));
    }
  }
  return st.length === 1 ? st[0] : null;
}

/** Verify a player's expression: valid syntax, each given number used
 *  exactly once, and the exact value 24. */
export function verify24Answer(numbers: number[], expr: string): boolean {
  const tokens = tokenize(expr);
  if (!tokens || tokens.length === 0) return false;

  const used = tokens
    .filter((t) => /^[0-9]+$/.test(t))
    .map((t) => parseInt(t, 10))
    .sort((a, b) => a - b);
  const given = [...numbers].sort((a, b) => a - b);
  if (used.length !== given.length || used.some((u, i) => u !== given[i])) {
    return false;
  }

  const rpn = toRpn(tokens);
  if (!rpn) return false;
  const val = evalRpn(rpn);
  if (!val) return false;
  return val.n === 24 * val.d;
}
