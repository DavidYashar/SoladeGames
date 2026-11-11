"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { bubblePopForDay, COLS, type BubbleKind } from "@/lib/games/bubble-pop";
import { dateKey } from "@/lib/puzzles/date";

const W = 360;
const H = 560;
const R = 15;
const CELL_W = R * 2;
const ROW_H = 26;
const TOP = 60;
const MARGIN = (W - COLS * CELL_W) / 2 + R;
const SHOOTER = { x: W / 2, y: H - 56 };
const SHOT_SPEED = 720;
const BEST_KEY = "imarket:bubble-pop:best";
const DAILY_KEY = "imarket:bubble-pop:daily";
const PERFECT_KEY = "imarket:bubble-pop:perfect";

// Steel-blue palette (matches the Neon Pinball cabinet).
const PALETTE = ["#38bdf8", "#f472b6", "#fbbf24", "#34d399", "#a78bfa"];
const DARK = ["#0c4a6e", "#9d174d", "#92400e", "#065f46", "#4c1d95"];
// Edge trim + glossy highlight for the chrome bubbles.
const TRIM = ["#dbeafe", "#fce7f3", "#fef3c7", "#d1fae5", "#ede9fe"];

// Special bubble styling.
const ICE_COL = "#93c5fd";
const ICE_DARK = "#1e40af";
const STONE_COL = "#cbd5e1";
const STONE_DARK = "#475569";
const BOMB_COL = "#1f2937";
const BOMB_DARK = "#000000";
const GOLD_COL = "#fde68a";
const GOLD_DARK = "#b45309";
const RAINBOW_COL = "#e0e7ff";

const EXPLOSION_R = R * 3.2; // bomb blast radius
const BONUS_SHOT_PER_CLEAR = 4; // bubbles per +1 shot

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Naive color mix toward white (amt > 0) or black (amt < 0). */
function mix(hex: string, amt: number): string {
  const [r, g, b] = hexRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const nr = Math.round(r + (t - r) * p);
  const ng = Math.round(g + (t - g) * p);
  const nb = Math.round(b + (t - b) * p);
  return `rgb(${nr},${ng},${nb})`;
}

// Rising tide — grows faster each wave.
const TIDE_START = H + 30;
const TIDE_BASE_SPEED = 7; // px/s
const TIDE_WAVE_BOOST = 5; // px/s per wave
const WAVE_CLEAR_STEP = 14; // bubbles cleared per wave

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  born: number;
  life: number;
  r: number;
}

interface Bubble {
  row: number;
  col: number;
  x: number;
  y: number;
  color: number;
  kind: BubbleKind;
  hits: number;
}

type Phase = "ready" | "playing" | "over" | "won";

interface GameState {
  bubbles: Bubble[];
  grid: Set<string>;
  shot: { x: number; y: number; vx: number; vy: number; color: number } | null;
  queue: number[];
  qIndex: number;
  aim: { x: number; y: number };
  score: number;
  combo: number;
  shotsLeft: number;
  wave: number;
  tideY: number;
  totalCleared: number;
  popups: ScorePopup[];
  particles: Particle[];
  shakeAmt: number;
  sweep: boolean;
  seed: string;
  phase: Phase;
  finalScore: number;
}

/* ---------- pure helpers ---------- */

function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

function cellCenter(r: number, c: number): { x: number; y: number } {
  return {
    x: MARGIN + c * CELL_W + (r % 2 ? R : 0),
    y: TOP + r * ROW_H,
  };
}

function neighborsOf(r: number, c: number): [number, number][] {
  const odd = r % 2 === 1;
  const raw: [number, number][] = [
    [r, c - 1],
    [r, c + 1],
    [r - 1, odd ? c : c - 1],
    [r - 1, odd ? c + 1 : c],
    [r + 1, odd ? c : c - 1],
    [r + 1, odd ? c + 1 : c],
  ];
  return raw.filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < COLS);
}

function matchesColor(b: Bubble, color: number): boolean {
  if (b.kind === "stone") return false; // indestructible — never joins a match
  if (b.kind === "rainbow") return true; // wildcard — matches any color
  return b.color === color;
}

function findMatches(st: GameState, r0: number, c0: number, color: number): Set<string> {
  const found = new Set<string>([keyOf(r0, c0)]);
  const stack: [number, number][] = [[r0, c0]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    for (const [nr, nc] of neighborsOf(r, c)) {
      const k = keyOf(nr, nc);
      if (st.grid.has(k) && !found.has(k)) {
        const b = st.bubbles.find((x) => x.row === nr && x.col === nc);
        if (b && matchesColor(b, color)) {
          found.add(k);
          stack.push([nr, nc]);
        }
      }
    }
  }
  return found;
}

function findFloating(st: GameState): Bubble[] {
  const anchored = new Set<string>();
  const stack: [number, number][] = [];
  for (const b of st.bubbles) {
    if (b.row === 0) {
      anchored.add(keyOf(0, b.col));
      stack.push([0, b.col]);
    }
  }
  while (stack.length) {
    const [r, c] = stack.pop()!;
    for (const [nr, nc] of neighborsOf(r, c)) {
      const k = keyOf(nr, nc);
      if (st.grid.has(k) && !anchored.has(k)) {
        anchored.add(k);
        stack.push([nr, nc]);
      }
    }
  }
  return st.bubbles.filter((b) => !anchored.has(keyOf(b.row, b.col)));
}

function snapCell(st: GameState, x: number, y: number): { row: number; col: number } | null {
  const row = Math.max(0, Math.round((y - TOP) / ROW_H));
  const col = Math.max(
    0,
    Math.min(COLS - 1, Math.round((x - MARGIN - (row % 2 ? R : 0)) / CELL_W)),
  );
  const candidates: [number, number][] = [[row, col], ...neighborsOf(row, col)];
  let best: { row: number; col: number } | null = null;
  let bestD = Infinity;
  for (const [r, c] of candidates) {
    if (st.grid.has(keyOf(r, c))) continue;
    const p = cellCenter(r, c);
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < bestD) {
      bestD = d2;
      best = { row: r, col: c };
    }
  }
  return best;
}

function aimDir(st: GameState): { x: number; y: number } {
  const dx = st.aim.x - SHOOTER.x;
  const dy = st.aim.y - SHOOTER.y;
  const len = Math.hypot(dx, dy) || 1;
  if (dy > 0) return { x: dx >= 0 ? 1 : -1, y: 0 };
  const base = Math.atan2(dy, dx);
  // Oscillating sweep — time your shot for the challenge mode.
  const sweepAmp = st.sweep ? 0.9 : 0;
  const ang = base + Math.sin(performance.now() / 420) * sweepAmp * 0.22;
  return { x: Math.cos(ang), y: Math.sin(ang) };
}

/* ---------- component ---------- */

function newState(): GameState {
  const key = dateKey();
  const seed = bubblePopForDay(key);
  const bubbles = seed.field.map((f) => ({
    row: f.row,
    col: f.col,
    ...cellCenter(f.row, f.col),
    color: f.color,
    kind: f.kind,
    hits: f.hits,
  }));
  return {
    bubbles,
    grid: new Set(bubbles.map((b) => keyOf(b.row, b.col))),
    shot: null,
    queue: seed.queue,
    qIndex: 0,
    aim: { x: W / 2, y: TOP },
    score: 0,
    combo: 1,
    shotsLeft: seed.shots,
    wave: 1,
    tideY: TIDE_START,
    totalCleared: 0,
    popups: [],
    particles: [],
    shakeAmt: 0,
    sweep: true,
    seed: key,
    phase: "ready",
    finalScore: 0,
  };
}

function loadBest(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(v));
  } catch {
    // ignore
  }
}

function loadDaily(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(DAILY_KEY + ":" + key)) || 0;
  } catch {
    return 0;
  }
}

function saveDaily(key: string, v: number) {
  try {
    window.localStorage.setItem(DAILY_KEY + ":" + key, String(v));
  } catch {
    // ignore
  }
}

function loadPerfect(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PERFECT_KEY + ":" + key) === "1";
  } catch {
    return false;
  }
}

function savePerfect(key: string) {
  try {
    window.localStorage.setItem(PERFECT_KEY + ":" + key, "1");
  } catch {
    // ignore
  }
}

/** Bubble Pop — aim, shoot, match 3+ to pop, drop floaters for bonus. */
export function BubblePopGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<GameState>(newState());
  const lastClickAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(1);
  const [shotsLeft, setShotsLeft] = useState(46);
  const [wave, setWave] = useState(1);
  const [dailyBest, setDailyBest] = useState(0);
  const [perfect, setPerfect] = useState(false);
  const [sweepOn, setSweepOn] = useState(true);

  useEffect(() => {
    setBest(loadBest());
    const st = stateRef.current;
    setDailyBest(loadDaily(st.seed));
    setPerfect(loadPerfect(st.seed));
  }, []);

  const syncHud = useCallback(() => {
    const st = stateRef.current;
    setPhase(st.phase);
    setScore(st.score);
    setCombo(st.combo);
    setShotsLeft(st.shotsLeft);
    setWave(st.wave);
  }, []);

  const maybeFinish = useCallback(() => {
    const st = stateRef.current;
    if (st.phase === "over" || st.phase === "won") {
      st.finalScore = st.score;
      if (st.score > loadBest()) {
        saveBest(st.score);
        setBest(st.score);
      }
      if (st.score > loadDaily(st.seed)) {
        saveDaily(st.seed, st.score);
      }
      if (st.phase === "won") {
        if (!loadPerfect(st.seed)) savePerfect(st.seed);
        setPerfect(true);
      }
      setDailyBest(loadDaily(st.seed));
    }
  }, []);

  const restart = useCallback(() => {
    stateRef.current = newState();
    syncHud();
  }, [syncHud]);

  const start = useCallback(() => {
    const st = stateRef.current;
    if (st.phase === "over" || st.phase === "won") restart();
    else if (st.phase === "ready") {
      st.phase = "playing";
      syncHud();
    }
  }, [restart, syncHud]);

  const shoot = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== "playing" || st.shot) return;
    const dir = aimDir(st);
    const color = st.queue[st.qIndex] ?? 0;
    st.qIndex += 1;
    st.shot = { x: SHOOTER.x, y: SHOOTER.y, vx: dir.x * SHOT_SPEED, vy: dir.y * SHOT_SPEED, color };
  }, []);

  // Spawn a floating score popup.
  const addPopup = useCallback((x: number, y: number, text: string, color: string) => {
    const st = stateRef.current;
    st.popups.push({ x, y, text, color, born: performance.now() });
    if (st.popups.length > 10) st.popups.shift();
  }, []);

  // Burst of small particles at a pop.
  const burst = useCallback((x: number, y: number, color: string, n = 10) => {
    const st = stateRef.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      st.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        color,
        born: performance.now(),
        life: 400 + Math.random() * 260,
        r: 1.6 + Math.random() * 2.6,
      });
    }
    if (st.particles.length > 160) st.particles.splice(0, st.particles.length - 160);
  }, []);

  // Bomb blast: collect an extra radius of bubbles (stones are immune).
  const collectBlast = useCallback((st: GameState, bx: number, by: number): string[] => {
    const out: string[] = [];
    for (const b of st.bubbles) {
      if (b.kind === "stone") continue;
      if (Math.hypot(b.x - bx, b.y - by) <= EXPLOSION_R) {
        out.push(keyOf(b.row, b.col));
      }
    }
    return out;
  }, []);

  const landShot = useCallback(() => {
    const st = stateRef.current;
    const s = st.shot;
    if (!s) return;
    const cell = snapCell(st, s.x, s.y);
    st.shot = null;
    if (!cell) return;

    const p = cellCenter(cell.row, cell.col);
    st.bubbles.push({
      row: cell.row,
      col: cell.col,
      x: p.x,
      y: p.y,
      color: s.color,
      kind: "normal",
      hits: 1,
    });
    st.grid.add(keyOf(cell.row, cell.col));

    // Expand matches — rainbow wildcards chain, bombs and gold are regular.
    const matches = findMatches(st, cell.row, cell.col, s.color);
    let removed = new Set<string>(matches);

    // Bomb bubbles in the matched cluster also blast a radius.
    for (const k of matches) {
      const b = st.bubbles.find((x) => keyOf(x.row, x.col) === k);
      if (b && b.kind === "bomb") {
        for (const bk of collectBlast(st, b.x, b.y)) removed.add(bk);
      }
    }

    if (matches.size >= 3 || removed.size >= 4) {
      // Score the group.
      let gained = 0;
      let goldCount = 0;
      for (const k of removed) {
        const b = st.bubbles.find((x) => keyOf(x.row, x.col) === k);
        if (!b) continue;
        if (b.kind === "gold") goldCount += 1;
        burst(b.x, b.y, PALETTE[b.color] ?? "#ffffff");
      }
      const clearCount = removed.size;
      const mult = 1 + Math.min(st.combo, 4);
      gained += 10 * clearCount * mult;
      gained += goldCount * 150;
      st.score += gained;
      st.combo += 1;
      addPopup(
        p.x,
        p.y - 12,
        "+" + gained,
        goldCount > 0 ? GOLD_COL : "#e0f2fe",
      );

      // Remove and drop floaters.
      st.bubbles = st.bubbles.filter((b) => !removed.has(keyOf(b.row, b.col)));
      for (const k of removed) st.grid.delete(k);
      const floating = findFloating(st);
      if (floating.length > 0) {
        st.bubbles = st.bubbles.filter((b) => !floating.includes(b));
        for (const b of floating) st.grid.delete(keyOf(b.row, b.col));
        const fBonus = 20 * floating.length;
        st.score += fBonus;
        addPopup(p.x, p.y - 30, "+" + fBonus, "#a5f3fc");
      }

      // Full-color clear bonus — wiped out an entire color from the board.
      if (st.bubbles.every((b) => b.color !== s.color || b.kind === "rainbow")) {
        const cBonus = 200;
        st.score += cBonus;
        addPopup(p.x, p.y - 46, "COLOR CLEAR +" + cBonus, "#f0abfc");
      }

      // Shot economy: big clears refund shots.
      const refund = Math.floor(clearCount / BONUS_SHOT_PER_CLEAR);
      if (refund > 0) {
        st.shotsLeft += refund;
        addPopup(p.x, p.y - 48, "+" + refund + " SHOT", "#fde68a");
      }

      // Wave progression — every N cleared bubbles speeds the tide.
      st.totalCleared += clearCount + floating.length;
      const nextWave = 1 + Math.floor(st.totalCleared / WAVE_CLEAR_STEP);
      if (nextWave > st.wave) {
        st.wave = nextWave;
        addPopup(W / 2, 120, "WAVE " + nextWave, "#f0abfc");
        st.shakeAmt = Math.min(10, st.shakeAmt + 5);
      }

      if (st.bubbles.length === 0) {
        st.phase = "won";
        maybeFinish();
        return;
      }
    } else {
      st.combo = 1;
      // A missed cluster still eats a shot.
      st.shotsLeft -= 1;
      // A dead shot advances the tide slightly (pressure).
      if (st.tideY > TOP) st.tideY -= 6;
    }

    syncHud();
    // Run out of shots = game over.
    if (st.phase === "playing" && st.shotsLeft <= 0) {
      st.phase = "over";
      maybeFinish();
      syncHud();
    }
  }, [addPopup, burst, collectBlast, maybeFinish, syncHud]);

  function step(st: GameState, dt: number) {
    // Rising tide grows each wave and slowly creeps up the board.
    if (st.phase === "playing") {
      const speed = TIDE_BASE_SPEED + (st.wave - 1) * TIDE_WAVE_BOOST;
      if (st.tideY > TOP) st.tideY -= speed * dt;
      // The tide swallows any bubble it overtakes — game over.
      if (st.tideY <= TOP + R && st.bubbles.length > 0) {
        if (st.bubbles.some((b) => b.y + R >= st.tideY)) {
          st.phase = "over";
          st.finalScore = st.score;
          maybeFinish();
          syncHud();
        }
      }
    }

    // Particles.
    for (const p of st.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    st.particles = st.particles.filter(
      (p) => performance.now() - p.born < p.life,
    );

    if (!st.shot) return;
    const s = st.shot;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x - R < 0) {
      s.x = R;
      s.vx = Math.abs(s.vx);
    }
    if (s.x + R > W) {
      s.x = W - R;
      s.vx = -Math.abs(s.vx);
    }
    if (s.y - R <= TOP) {
      landShot();
      return;
    }
    for (const b of st.bubbles) {
      const d2 = (b.x - s.x) ** 2 + (b.y - s.y) ** 2;
      if (d2 < (2 * R) * (2 * R)) {
        landShot();
        return;
      }
    }
  }

  function aimHit(st: GameState): { x: number; y: number } {
    const dir = aimDir(st);
    let x = SHOOTER.x;
    let y = SHOOTER.y;
    let vx = dir.x;
    let vy = dir.y;
    for (let i = 0; i < 120; i++) {
      x += vx * 8;
      y += vy * 8;
      // Bank off the side walls (the shot really ricochets).
      if (x < R) {
        x = R;
        vx = Math.abs(vx);
      }
      if (x > W - R) {
        x = W - R;
        vx = -Math.abs(vx);
      }
      if (y - R <= TOP) return { x, y };
      for (const b of st.bubbles) {
        if ((b.x - x) ** 2 + (b.y - y) ** 2 < (2 * R) ** 2) return { x, y };
      }
    }
    return { x, y };
  }

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;

    let raf = 0;
    let last = performance.now();

    const bubbleColors = (b: Bubble) => {
      switch (b.kind) {
        case "ice":
          return { fill: b.hits > 1 ? ICE_COL : mix(ICE_COL, 0.25), stroke: ICE_DARK, trim: "#eff6ff" };
        case "stone":
          return { fill: STONE_COL, stroke: STONE_DARK, trim: "#f8fafc" };
        case "bomb":
          return { fill: BOMB_COL, stroke: BOMB_DARK, trim: "#fca5a5" };
        case "gold":
          return { fill: GOLD_COL, stroke: GOLD_DARK, trim: "#fffbeb" };
        case "rainbow":
          return { fill: RAINBOW_COL, stroke: "#818cf8", trim: "#e0e7ff" };
        default:
          return { fill: PALETTE[b.color], stroke: DARK[b.color], trim: TRIM[b.color] };
      }
    };

    const loop = (t: number) => {
      const st = stateRef.current;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (st.phase === "playing") step(st, dt);

      const c = ctxRef.current!;
      c.clearRect(0, 0, W, H);

      // Screen shake.
      c.save();
      if (st.shakeAmt > 0.3) {
        c.translate((Math.random() - 0.5) * st.shakeAmt, (Math.random() - 0.5) * st.shakeAmt);
        st.shakeAmt *= 0.9;
      }

      // Steel cabinet bezel.
      c.fillStyle = "#23262d";
      c.beginPath();
      c.roundRect(0, 0, W, H, 18);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.07)";
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(2, 2, W - 4, H - 4, 16);
      c.stroke();

      // Glossy blue playfield (matches the pinball).
      const pg = c.createLinearGradient(0, 0, 0, H);
      pg.addColorStop(0, "#2b6fae");
      pg.addColorStop(0.5, "#1e5b97");
      pg.addColorStop(1, "#123b6b");
      c.fillStyle = pg;
      c.beginPath();
      c.roundRect(16, 30, W - 32, H - 34, 22);
      c.fill();
      const gloss = c.createLinearGradient(0, 30, 0, 210);
      gloss.addColorStop(0, "rgba(255,255,255,0.12)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gloss;
      c.beginPath();
      c.roundRect(16, 30, W - 32, 180, 22);
      c.fill();

      // Steel side rails.
      c.strokeStyle = "#9aa6b4";
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(16, 30);
      c.lineTo(16, H - 8);
      c.moveTo(W - 16, 30);
      c.lineTo(W - 16, H - 8);
      c.stroke();

      // Grid dots (steel-blue).
      c.fillStyle = "rgba(120,160,200,0.14)";
      for (let r = 0; r < 18; r++) {
        for (let cc = 0; cc < COLS; cc++) {
          const p = cellCenter(r, cc);
          if (p.y < H - 90) {
            c.beginPath();
            c.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            c.fill();
          }
        }
      }

      // Rising tide (glowing band) — danger from the bottom.
      if (st.tideY < H) {
        const ty = Math.max(st.tideY, 16);
        const tg = c.createLinearGradient(0, ty, 0, H);
        tg.addColorStop(0, "rgba(244,114,182,0.18)");
        tg.addColorStop(0.6, "rgba(244,114,182,0.32)");
        tg.addColorStop(1, "rgba(244,114,182,0.55)");
        c.fillStyle = tg;
        c.beginPath();
        c.roundRect(16, ty, W - 32, H - ty - 4, 8);
        c.fill();
        c.strokeStyle = "rgba(251,146,60,0.85)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(18, ty + 1);
        c.lineTo(W - 18, ty + 1);
        c.stroke();
      }

      // Bubbles.
      for (const b of st.bubbles) {
        const col = bubbleColors(b);
        // Ice cracks shown as a lighter overlay ring.
        c.fillStyle = col.fill;
        c.strokeStyle = col.stroke;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(b.x, b.y, R, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        // Chrome rim.
        c.strokeStyle = col.trim;
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(b.x, b.y, R - 3, 0, Math.PI * 2);
        c.stroke();
        // Glossy highlight.
        c.fillStyle = "rgba(255,255,255,0.4)";
        c.beginPath();
        c.arc(b.x - 5, b.y - 6, 4, 0, Math.PI * 2);
        c.fill();
        // Special markers.
        if (b.kind === "bomb") {
          c.strokeStyle = "#fca5a5";
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(b.x, b.y + R - 2);
          c.lineTo(b.x, b.y + R + 3);
          c.stroke();
        } else if (b.kind === "gold") {
          c.fillStyle = "rgba(255,255,255,0.8)";
          c.beginPath();
          c.arc(b.x + 3, b.y + 3, 2, 0, Math.PI * 2);
          c.fill();
        }
      }

      // Aim line (banks off side walls; oscillates in sweep mode).
      if (st.phase === "playing" && !st.shot) {
        const hit = aimHit(st);
        c.strokeStyle = st.sweep ? "rgba(125,211,252,0.55)" : "rgba(255,255,255,0.4)";
        c.lineWidth = 1.5;
        c.setLineDash([6, 6]);
        c.beginPath();
        c.moveTo(SHOOTER.x, SHOOTER.y);
        c.lineTo(hit.x, hit.y);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "rgba(125,211,252,0.8)";
        c.beginPath();
        c.arc(hit.x, hit.y, 3.5, 0, Math.PI * 2);
        c.fill();
      }

      // Shot bubble.
      if (st.shot) {
        c.fillStyle = PALETTE[st.shot.color];
        c.shadowColor = PALETTE[st.shot.color];
        c.shadowBlur = 12;
        c.beginPath();
        c.arc(st.shot.x, st.shot.y, R, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      }

      // Shooter: chrome plunger + current / next bubble.
      if (st.phase !== "over" && st.phase !== "won") {
        // Plunger base.
        c.fillStyle = "#1b1e24";
        c.beginPath();
        c.roundRect(SHOOTER.x - R - 8, SHOOTER.y - 6, R * 2 + 16, 34, 8);
        c.fill();
        c.strokeStyle = "rgba(255,255,255,0.15)";
        c.lineWidth = 1;
        c.beginPath();
        c.roundRect(SHOOTER.x - R - 8, SHOOTER.y - 6, R * 2 + 16, 34, 8);
        c.stroke();

        const cur = st.queue[st.qIndex] ?? 0;
        const nxt = st.queue[st.qIndex + 1] ?? 0;
        c.fillStyle = PALETTE[cur];
        c.strokeStyle = DARK[cur];
        c.lineWidth = 2;
        c.beginPath();
        c.arc(SHOOTER.x, SHOOTER.y, R, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = PALETTE[nxt];
        c.strokeStyle = DARK[nxt];
        c.beginPath();
        c.arc(SHOOTER.x - R * 2 - 6, SHOOTER.y, R - 4, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }

      // Particles.
      for (const p of st.particles) {
        const a = 1 - (performance.now() - p.born) / p.life;
        c.globalAlpha = Math.max(0, a);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      // Floating popups.
      for (const p of st.popups) {
        const age = performance.now() - p.born;
        const a = 1 - age / 900;
        if (a <= 0) continue;
        c.globalAlpha = Math.max(0, a);
        c.fillStyle = p.color;
        c.font = "bold 13px ui-monospace, monospace";
        c.textAlign = "center";
        c.fillText(p.text, p.x, p.y - age * 0.045);
      }
      c.globalAlpha = 1;

      c.restore();

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [landShot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard.
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        const st = stateRef.current;
        if (st.phase === "over" || st.phase === "won") restart();
        else if (st.phase === "ready") start();
        else shoot();
      }
    }
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [restart, start, shoot]);

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const st = stateRef.current;
    st.aim = {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function onCanvasClick(e: React.PointerEvent<HTMLCanvasElement>) {
    const now = performance.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const st = stateRef.current;
    st.aim = {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
    if (st.phase === "over" || st.phase === "won") {
      lastClickAtRef.current = now;
      restart();
      return;
    }
    // Ignore the click that passes through right after an overlay unmounts.
    if (now - lastClickAtRef.current < 300) return;
    lastClickAtRef.current = now;
    if (st.phase === "ready") start();
    else shoot();
  }

  const toggleSweep = useCallback(() => {
    const st = stateRef.current;
    st.sweep = !st.sweep;
    setSweepOn(st.sweep);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-sm items-center justify-between text-sm">
        <p className="text-zinc-400">
          Score:{" "}
          <span className="font-display text-lg text-zinc-100">{score}</span>
          {combo > 1 && (
            <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 font-display text-xs font-bold text-amber-300">
              ×{combo}
            </span>
          )}
        </p>
        <div className="flex items-center gap-3 text-right">
          <span className="font-display text-xs text-sky-300">Shots {shotsLeft}</span>
          <span className="font-display text-xs text-fuchsia-300">Wave {wave}</span>
          <span className="font-display text-zinc-200">
            Best: {best}
          </span>
        </div>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between text-xs">
        <button
          onClick={toggleSweep}
          className={
            "rounded-full border px-2.5 py-1 font-semibold transition " +
            (sweepOn
              ? "border-sky-400/50 bg-sky-500/15 text-sky-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-400")
          }
        >
          {sweepOn ? "😵 Sweep ON" : "🎯 Sweep OFF"}
        </button>
        <span className="text-zinc-500">
          Daily best <span className="font-mono text-zinc-300">{dailyBest}</span>
          {perfect && <span className="ml-2 text-amber-300">🏅 perfect</span>}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 shadow-xl shadow-sky-950/40">
        <canvas
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onClick={onCanvasClick}
          className="block cursor-crosshair"
          style={{ width: W, height: H, touchAction: "none" }}
        />
        {phase === "ready" && (
          <button
            onClick={() => {
              lastClickAtRef.current = performance.now();
              start();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 text-center"
          >
            <span className="text-3xl">🫧</span>
            <span className="font-display text-lg tracking-wide">Bubble Pop</span>
            <span className="text-sm text-zinc-400">
              Aim with your mouse, click to shoot.
              <br />
              Match 3+ to pop · drop floaters for bonus.
              <br />
              Clear big groups for extra shots. Mind the rising tide!
            </span>
            <span className="arcade-chip mt-2">Insert coin · Play</span>
          </button>
        )}
        {phase === "over" && (
          <button
            onClick={() => {
              lastClickAtRef.current = performance.now();
              restart();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 text-center"
          >
            <span className="text-3xl">🫠</span>
            <span className="font-display text-xl tracking-wide">Run over</span>
            <span className="text-sm text-zinc-400">Out of shots, or the tide caught you.</span>
            <span className="text-sm text-zinc-300">
              Score{" "}
              <span className="font-mono text-lg">{stateRef.current.finalScore}</span>
              {stateRef.current.finalScore >= best && best > 0
                ? " — new best!"
                : ""}
            </span>
            <span className="arcade-chip mt-2">Play again</span>
          </button>
        )}
        {phase === "won" && (
          <button
            onClick={() => {
              lastClickAtRef.current = performance.now();
              restart();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 text-center"
          >
            <span className="text-3xl">🏆</span>
            <span className="font-display text-xl tracking-wide">Board cleared!</span>
            <span className="text-sm text-zinc-300">
              Score{" "}
              <span className="font-mono text-lg">{stateRef.current.finalScore}</span>
              {stateRef.current.finalScore >= best && best > 0
                ? " — new best!"
                : ""}
              {perfect ? " · 🏅 perfect clear!" : ""}
            </span>
            <span className="arcade-chip mt-2">Play again</span>
          </button>
        )}
      </div>

      <p className="text-center text-xs text-zinc-600">
        Steel-blue cabinet · daily seeded board (the exact board tournaments
        will use) · paid rounds 0.10 USDC coming soon
      </p>
    </div>
  );
}
