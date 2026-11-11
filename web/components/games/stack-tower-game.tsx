"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  stackSpecsForDay,
  type BlockSpec,
  type StackKind,
} from "@/lib/games/stack-tower";
import { dateKey } from "@/lib/puzzles/date";

const W = 360;
const H = 540;
const BLOCK_H = 28;
const BASE_W = 180;
const PERFECT_PX = 3;
const BEST_KEY = "imarket:stack-tower:best";
const DAILY_KEY = "imarket:stack-tower:daily";
const PERFECT_KEY = "imarket:stack-tower:perfect";

// Steel-blue palette (matches the other arcade games).
const WALL_FACE = "#8a97a6";
const WALL_MORTAR = "rgba(30,41,59,0.5)";

// Special block colors.
const KIND_COLORS: Record<StackKind, string> = {
  normal: "#38bdf8",
  gold: "#fbbf24",
  bomb: "#fb7185",
  stone: "#94a3b8",
};

// Perfect-streak combo + milestone tuning.
const COMBO_MAX = 5; // ×1..×5
const MILESTONE = 20; // every N blocks

interface Block {
  x: number;
  w: number;
  y: number;
  hue: number;
  kind: StackKind;
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

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

interface GameState {
  blocks: Block[];
  current: { x: number; w: number; y: number; dir: 1 | -1; speed: number; kind: StackKind };
  specs: BlockSpec[];
  specIndex: number;
  score: number;
  combo: number;
  streak: number;
  over: boolean;
  perfectAt: number; // timestamp of last perfect drop
  particles: Particle[];
  popups: ScorePopup[];
  shakeAmt: number;
  dropGuide: { x: number; w: number } | null;
  milestonedAt: number;
  seed: string;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Naive color mix toward white (amt > 0) or black (amt < 0). Supports hex AND hsl(). */
function mix(color: string, amt: number): string {
  if (color.startsWith("#")) {
    const [r, g, b] = hexRgb(color);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const nr = Math.round(r + (t - r) * p);
    const ng = Math.round(g + (t - g) * p);
    const nb = Math.round(b + (t - b) * p);
    return `rgb(${nr},${ng},${nb})`;
  }
  // hsl(...) → shift lightness.
  const m = color.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!m) return color;
  const h = m[1];
  const s = m[2];
  const l = Math.max(0, Math.min(100, parseFloat(m[3]) + amt * 100 * (amt < 0 ? -0.5 : 0.5)));
  return `hsl(${h} ${s}% ${l}%)`;
}

function newState(): GameState {
  const key = dateKey();
  const specs = stackSpecsForDay(key, 400);
  const y0 = H - BLOCK_H - 12;
  const first = specs[0];
  return {
    blocks: [{ x: (W - BASE_W) / 2, w: BASE_W, y: y0, hue: 190, kind: "normal" }],
    current: {
      x: (W - BASE_W) / 2,
      w: BASE_W,
      y: y0 - BLOCK_H,
      dir: first.dir,
      speed: first.speed,
      kind: first.kind,
    },
    specs,
    specIndex: 1,
    score: 0,
    combo: 1,
    streak: 0,
    over: false,
    perfectAt: 0,
    particles: [],
    popups: [],
    shakeAmt: 0,
    dropGuide: null,
    milestonedAt: 0,
    seed: key,
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

/** Stack Tower — tap/click/Space to drop the moving block. */
export function StackTowerGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<GameState>(newState());
  const lastClickAtRef = useRef(0);

  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [perfect, setPerfect] = useState(false);
  const [combo, setCombo] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyBest, setDailyBest] = useState(0);
  const [hatPerfect, setHatPerfect] = useState(false);

  useEffect(() => {
    setBest(loadBest());
    const st = stateRef.current;
    setDailyBest(loadDaily(st.seed));
    setHatPerfect(loadPerfect(st.seed));
  }, []);

  const addPopup = useCallback((x: number, y: number, text: string, color: string) => {
    const st = stateRef.current;
    st.popups.push({ x, y, text, color, born: performance.now() });
    if (st.popups.length > 10) st.popups.shift();
  }, []);

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

  const endGame = useCallback(() => {
    const st = stateRef.current;
    if (st.over) return;
    st.over = true;
    setPhase("over");
    if (st.score > loadBest()) {
      saveBest(st.score);
      setBest(st.score);
    }
    if (st.score > loadDaily(st.seed)) saveDaily(st.seed, st.score);
    setDailyBest(loadDaily(st.seed));
  }, []);

  const drop = useCallback(() => {
    const st = stateRef.current;
    if (st.over) return;

    const prev = st.blocks[st.blocks.length - 1];
    const cur = st.current;
    const left = Math.max(prev.x, cur.x);
    const right = Math.min(prev.x + prev.w, cur.x + cur.w);
    const overlap = right - left;

    if (overlap <= 0) {
      endGame();
      return;
    }

    const centerDiff = Math.abs(cur.x + cur.w / 2 - (prev.x + prev.w / 2));
    const isPerfect = centerDiff <= PERFECT_PX;
    const kind = cur.kind;

    // Perfect streak: consecutive perfects build a combo multiplier.
    let combo = st.combo;
    const prevStreak = st.streak;
    if (isPerfect) {
      st.streak += 1;
      combo = Math.min(COMBO_MAX, 1 + Math.floor(st.streak / 3));
    } else {
      st.streak = 0;
      combo = 1;
    }

    // Special block effects on placement.
    let w = overlap;
    let bonus = 0;
    if (isPerfect) {
      w = prev.w; // perfect keeps full width
    }
    if (kind === "stone") {
      // Stone keeps a big chunk (harder to cut down) but is heavier to align.
      if (w < prev.w) w = Math.max(w, prev.w * 0.75);
      bonus += 2;
    } else if (kind === "gold") {
      // Gold restores width toward the base and pays a bonus.
      w = Math.min(BASE_W, prev.w + 14);
      bonus += 5;
    } else if (kind === "bomb") {
      // Bomb shrinks the tower by a chunk (risk).
      w = Math.max(6, w * 0.7);
    }

    const placedHue = (190 + st.score * 47) % 360;
    const placed: Block = { x: left, w, y: cur.y, hue: placedHue, kind };
    st.blocks.push(placed);

    const gained = 1 + bonus + combo - 1;
    const nextScore = st.score + gained;
    st.score = nextScore;
    st.combo = combo;
    setScore(nextScore);
    setCombo(combo);
    setStreak(st.streak);

    if (isPerfect) {
      st.perfectAt = performance.now();
      setPerfect(true);
      setTimeout(() => setPerfect(false), 400);
      addPopup(cur.x + cur.w / 2, cur.y - 6, "PERFECT", "#34d399");
    } else if (kind === "gold") {
      addPopup(cur.x + cur.w / 2, cur.y - 6, "GOLD +" + bonus, KIND_COLORS.gold);
    } else if (kind === "bomb") {
      addPopup(cur.x + cur.w / 2, cur.y - 6, "BOMB -" + Math.round((1 - w / (prev.w || 1)) * 100) + "%", KIND_COLORS.bomb);
      burst(cur.x + cur.w / 2, cur.y, KIND_COLORS.bomb, 12);
      st.shakeAmt = Math.min(8, st.shakeAmt + 4);
    } else if (kind === "stone") {
      addPopup(cur.x + cur.w / 2, cur.y - 6, "STONE +2", KIND_COLORS.stone);
    }
    burst(cur.x + cur.w / 2, cur.y, `hsl(${placedHue} 90% 58%)`, 4);
    st.shakeAmt = Math.min(6, st.shakeAmt + 1.2);

    // Milestone wave banner.
    const nextScore2 = st.score;
    if (
      nextScore2 >= MILESTONE &&
      st.milestonedAt !== Math.floor(nextScore2 / MILESTONE)
    ) {
      st.milestonedAt = Math.floor(nextScore2 / MILESTONE);
      addPopup(W / 2, 120, "FLOOR " + nextScore2, "#f0abfc");
    }

    const nextY = cur.y - BLOCK_H;
    if (nextY <= 0) {
      endGame();
      return;
    }

    const spec = st.specs[st.specIndex] ?? { dir: 1 as const, speed: 140, kind: "normal" as const };
    st.specIndex += 1;
    st.current = {
      x: spec.dir === 1 ? 0 : W - placed.w,
      w: placed.w,
      y: nextY,
      dir: spec.dir,
      speed: spec.speed,
      kind: spec.kind,
    };
    st.dropGuide = { x: placed.x, w: placed.w };
  }, [addPopup, burst, endGame]);

  const restart = useCallback(() => {
    stateRef.current = newState();
    setScore(0);
    setCombo(1);
    setStreak(0);
    setPhase("playing");
  }, []);

  const start = useCallback(() => {
    if (stateRef.current.over) {
      restart();
      return;
    }
    setPhase((p) => (p === "ready" ? "playing" : p));
  }, [restart]);

  // Keyboard controls.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      e.preventDefault();
      const st = stateRef.current;
      if (st.over) restart();
      else if (phase === "ready") start();
      else drop();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, drop, restart, start]);

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

    const loop = (t: number) => {
      const st = stateRef.current;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      if (!st.over && phaseRef.current === "playing") {
        const c = st.current;
        c.x += c.dir * c.speed * dt;
        if (c.x < 0) {
          c.x = 0;
          c.dir = 1;
        } else if (c.x + c.w > W) {
          c.x = W - c.w;
          c.dir = -1;
        }
      }

      // Draw.
      const ctx2 = ctxRef.current!;
      ctx2.clearRect(0, 0, W, H);

      // Screen shake.
      ctx2.save();
      if (st.shakeAmt > 0.3) {
        ctx2.translate((Math.random() - 0.5) * st.shakeAmt, (Math.random() - 0.5) * st.shakeAmt);
        st.shakeAmt *= 0.9;
      }

      // Steel cabinet bezel.
      ctx2.fillStyle = "#23262d";
      ctx2.beginPath();
      ctx2.roundRect(0, 0, W, H, 18);
      ctx2.fill();
      ctx2.strokeStyle = "rgba(255,255,255,0.07)";
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.roundRect(2, 2, W - 4, H - 4, 16);
      ctx2.stroke();

      // Glossy blue playfield.
      const pg = ctx2.createLinearGradient(0, 0, 0, H);
      pg.addColorStop(0, "#2b6fae");
      pg.addColorStop(0.5, "#1e5b97");
      pg.addColorStop(1, "#123b6b");
      ctx2.fillStyle = pg;
      ctx2.beginPath();
      ctx2.roundRect(16, 30, W - 32, H - 34, 22);
      ctx2.fill();
      const gloss = ctx2.createLinearGradient(0, 30, 0, 180);
      gloss.addColorStop(0, "rgba(255,255,255,0.12)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx2.fillStyle = gloss;
      ctx2.beginPath();
      ctx2.roundRect(16, 30, W - 32, 150, 22);
      ctx2.fill();

      // Grid lines.
      ctx2.strokeStyle = "rgba(120,160,200,0.12)";
      ctx2.lineWidth = 1;
      for (let gx = 16; gx <= W - 16; gx += 36) {
        ctx2.beginPath();
        ctx2.moveTo(gx, 30);
        ctx2.lineTo(gx, H - 8);
        ctx2.stroke();
      }

      // Drop guide line (the exact overlap with the block below).
      if (st.dropGuide) {
        ctx2.strokeStyle = "rgba(125,211,252,0.45)";
        ctx2.lineWidth = 1.5;
        ctx2.setLineDash([5, 5]);
        ctx2.strokeRect(st.dropGuide.x, st.current.y, st.dropGuide.w, BLOCK_H - 2);
        ctx2.setLineDash([]);
      }

      // Placed blocks (chunky 3D chrome).
      for (const b of st.blocks) {
        const col = b.kind === "normal" ? `hsl(${b.hue % 360} 80% 58%)` : KIND_COLORS[b.kind];
        // Dark side face.
        ctx2.fillStyle = mix(col, -0.55);
        ctx2.fillRect(b.x + 1, b.y + 2, b.w, BLOCK_H - 2);
        // Top face.
        ctx2.fillStyle = col;
        ctx2.fillRect(b.x, b.y, b.w, BLOCK_H - 2);
        // Gloss strip.
        ctx2.fillStyle = "rgba(255,255,255,0.28)";
        ctx2.fillRect(b.x, b.y, b.w, 4);
        // Accent edge.
        ctx2.strokeStyle = "rgba(255,255,255,0.25)";
        ctx2.lineWidth = 1;
        ctx2.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, BLOCK_H - 3);
      }

      // Moving block with glow.
      const c = st.current;
      if (!st.over) {
        const base = c.kind === "normal" ? `hsl(${(190 + st.score * 47) % 360} 90% 60%)` : KIND_COLORS[c.kind];
        ctx2.shadowColor = base;
        ctx2.shadowBlur = 14;
        ctx2.fillStyle = base;
        ctx2.fillRect(c.x, c.y, c.w, BLOCK_H - 2);
        ctx2.shadowBlur = 0;
        ctx2.fillStyle = "rgba(255,255,255,0.3)";
        ctx2.fillRect(c.x, c.y, c.w, 4);
        // Special marker.
        if (c.kind === "gold") {
          ctx2.fillStyle = "#7c2d12";
          ctx2.font = "bold 11px ui-monospace, monospace";
          ctx2.textAlign = "center";
          ctx2.fillText("G", c.x + c.w / 2, c.y + BLOCK_H - 8);
        } else if (c.kind === "bomb") {
          ctx2.fillStyle = "#7f1d1d";
          ctx2.font = "bold 11px ui-monospace, monospace";
          ctx2.textAlign = "center";
          ctx2.fillText("✕", c.x + c.w / 2, c.y + BLOCK_H - 8);
        } else if (c.kind === "stone") {
          ctx2.fillStyle = "#334155";
          ctx2.font = "bold 11px ui-monospace, monospace";
          ctx2.textAlign = "center";
          ctx2.fillText("◆", c.x + c.w / 2, c.y + BLOCK_H - 8);
        }
      }

      // Particles.
      for (const p of st.particles) {
        const a = 1 - (t - p.born) / p.life;
        ctx2.globalAlpha = Math.max(0, a);
        ctx2.fillStyle = p.color;
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.globalAlpha = 1;

      // Floating popups.
      for (const p of st.popups) {
        const age = t - p.born;
        const a = 1 - age / 900;
        if (a <= 0) continue;
        ctx2.globalAlpha = Math.max(0, a);
        ctx2.fillStyle = p.color;
        ctx2.font = "bold 13px ui-monospace, monospace";
        ctx2.textAlign = "center";
        ctx2.fillText(p.text, p.x, p.y - age * 0.045);
      }
      ctx2.globalAlpha = 1;

      ctx2.restore();

      raf = requestAnimationFrame(loop);
    };

    const phaseRef = { current: "ready" } as { current: string };
    // Keep phaseRef in sync for the loop.
    const sync = () => {
      phaseRef.current = stateRef.current.over ? "over" : phase;
    };
    sync();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const handleClick = useCallback(() => {
    // Ignore the click that "passes through" right after an overlay button
    // unmounts (same physical click, new target = canvas).
    if (performance.now() - lastClickAtRef.current < 300) return;
    const st = stateRef.current;
    if (st.over) {
      lastClickAtRef.current = performance.now();
      restart();
    } else if (phase === "ready") {
      lastClickAtRef.current = performance.now();
      start();
    } else {
      drop();
    }
  }, [phase, drop, restart, start]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-sm items-center justify-between text-sm">
        <p className="text-zinc-400">
          Score: <span className="font-display text-lg text-zinc-100">{score}</span>
          {combo > 1 && (
            <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 font-display text-xs font-bold text-amber-300">
              ×{combo}
            </span>
          )}
        </p>
        <p className="text-zinc-500">
          Best: <span className="font-display text-zinc-200">{best}</span>
        </p>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between text-xs">
        <span className="text-zinc-500">
          {streak > 1 ? (
            <span className="text-emerald-300">🔥 {streak} streak</span>
          ) : (
            <span>Perfect streak = combo ×</span>
          )}
        </span>
        <span className="text-zinc-500">
          Daily best <span className="font-display text-zinc-300">{dailyBest}</span>
          {hatPerfect && <span className="ml-2 text-amber-300">🏅 perfect</span>}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 shadow-xl shadow-sky-950/40">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="block cursor-pointer"
          style={{ width: W, height: H }}
        />
        {perfect && (
          <p className="pointer-events-none absolute inset-x-0 top-6 text-center font-mono text-lg font-bold text-emerald-300 drop-shadow">
            PERFECT
          </p>
        )}
        {phase === "ready" && (
          <button
            onClick={handleClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 text-center"
          >
            <span className="text-3xl">🗼</span>
            <span className="font-display text-lg tracking-wide">Stack Tower</span>
            <span className="text-sm text-zinc-400">
              Click or press Space to drop the block.
              <br />
              Perfect alignment keeps your full width.
              <br />
              Gold restores width · Bomb shrinks · Stone is heavy.
            </span>
            <span className="arcade-chip mt-2">Insert coin · Play</span>
          </button>
        )}
        {phase === "over" && (
          <button
            onClick={handleClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 text-center"
          >
            <span className="text-3xl">💥</span>
            <span className="font-display text-xl tracking-wide">Tower fell!</span>
            <span className="text-sm text-zinc-300">
              Height <span className="font-mono text-lg">{score}</span>
              {score >= best && score > 0 ? " — new best!" : ""}
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
