"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  brickLayoutForDay,
  type BrickKind,
  type PowerKind,
} from "@/lib/games/brick-blitz";
import { dateKey } from "@/lib/puzzles/date";

const W = 480;
const H = 620;
const PAD = 20;
const GAP = 6;
const COLS = 8;
const ROWS = 6;
const BRICK_W = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
const BRICK_H = 20;
const TOP = 80;
const PADDLE_W = 96;
const PADDLE_H = 12;
const PADDLE_Y = H - 42;
const BALL_R = 7;
const BASE_SPEED = 250;
const MAX_SPEED = 430;
const BEST_KEY = "imarket:brick-blitz:best";
const DAILY_KEY = "imarket:brick-blitz:daily";
const PERFECT_KEY = "imarket:brick-blitz:perfect";

// Steel-blue palette (matches the pinball + Bubble Pop).
const PADDLE_BASE = 96;
const POWER_COLORS: Record<PowerKind, string> = {
  expand: "#38bdf8",
  multi: "#f472b6",
  laser: "#fbbf24",
  fire: "#fb7185",
  slow: "#34d399",
  fast: "#a78bfa",
  life: "#4ade80",
};
const POWER_LABELS: Record<PowerKind, string> = {
  expand: "EXPAND",
  multi: "MULTI",
  laser: "LASER",
  fire: "FIRE",
  slow: "SLOW",
  fast: "FAST",
  life: "+LIFE",
};

// Hazard (descending wall) tuning.
const HAZARD_START = TOP - 10;
const HAZARD_BASE_SPEED = 8; // px/s
const HAZARD_WAVE_BOOST = 5; // px/s per wave

// Stone wall frame around the playfield (inner faces where the ball bounces).
const WALL_L = 16; // left inner face (left edge of the blue playfield)
const WALL_R = W - 16; // right inner face
const WALL_TOP = 30; // top inner face
const WALL_BOT = H - 16; // bottom (paddle zone)
const WALL_FACE = "#8a97a6";
const WALL_MORTAR = "rgba(30,41,59,0.5)";

// Ball speeds up as more bricks are destroyed.
const MAX_SPEED_GROWTH = 320; // added to MAX_SPEED across the run
const DESTROY_SPEED_STEP = 6; // +px/s per destroyed brick

interface Ripple {
  x: number;
  y: number;
  born: number;
  life: number;
  color: string;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  points: number;
  hue: number;
  kind: BrickKind;
  pu: PowerKind | null;
  homeX: number; // for moving bricks
  vx: number; // for moving bricks
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fire: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  vy: number;
  kind: PowerKind;
  w: number;
  h: number;
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

type Phase = "ready" | "playing" | "over" | "won";

interface GameState {
  bricks: Brick[];
  balls: Ball[];
  paddleX: number;
  paddleW: number;
  lives: number;
  score: number;
  combo: number;
  launched: boolean;
  aim: { x: number; y: number };
  wave: number;
  hazardY: number;
  powerUntil: Partial<Record<PowerKind, number>>;
  falling: PowerUp[];
  particles: Particle[];
  popups: ScorePopup[];
  shakeAmt: number;
  destroyed: number;
  ripples: Ripple[];
  seed: string;
  phase: Phase;
  finalScore: number;
}

function newState(wave = 1): GameState {
  const key = dateKey();
  const bricks = brickLayoutForDay(key, wave).map((s) => ({
    x: PAD + s.c * (BRICK_W + GAP),
    y: TOP + s.r * (BRICK_H + GAP),
    w: BRICK_W,
    h: BRICK_H,
    hp: s.hp,
    points: s.points,
    hue: s.hue,
    kind: s.kind,
    pu: s.pu,
    homeX: PAD + s.c * (BRICK_W + GAP),
    vx: 0,
  }));
  return {
    bricks,
    balls: [{ x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, fire: false }],
    paddleX: (W - PADDLE_BASE) / 2,
    paddleW: PADDLE_BASE,
    lives: 3,
    score: 0,
    combo: 1,
    launched: false,
    aim: { x: W / 2, y: 200 },
    wave,
    hazardY: HAZARD_START,
    powerUntil: {},
    falling: [],
    particles: [],
    popups: [],
    shakeAmt: 0,
    destroyed: 0,
    ripples: [],
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

/** Rainbow / hue cycling helper for special bricks. */
function brickFace(br: Brick, now: number): string {
  switch (br.kind) {
    case "steel":
      return "#94a3b8";
    case "gold":
      return "#fde68a";
    case "bomb":
      return "#334155";
    case "rainbow": {
      const hue = (now / 30 + br.hue) % 360;
      return `hsl(${hue} 85% 58%)`;
    }
    case "armored":
      return `hsl(${br.hue} 70% 42%)`;
    case "moving":
      return `hsl(${br.hue} 80% 52%)`;
    default:
      return `hsl(${br.hue} 85% ${br.hp > 1 ? 46 : 55}%)`;
  }
}

/** Predicted first-hit point for the launch ghost line. */
function ghostHit(st: GameState, x0: number, y0: number): { x: number; y: number } {
  const dx = st.aim.x - x0;
  const dy = st.aim.y - y0;
  const len = Math.hypot(dx, dy) || 1;
  const tilt = Math.max(-0.85, Math.min(0.85, dx / len) * 0.9);
  let vx = tilt * BASE_SPEED * 0.6;
  let vy = -Math.sqrt(Math.max(0, BASE_SPEED ** 2 - vx ** 2));
  let x = x0;
  let y = y0;
  for (let i = 0; i < 120; i++) {
    x += (vx / 60) * 8;
    y += (vy / 60) * 8;
    if (x - BALL_R < WALL_L) {
      x = WALL_L + BALL_R;
      vx = Math.abs(vx);
    }
    if (x + BALL_R > WALL_R) {
      x = WALL_R - BALL_R;
      vx = -Math.abs(vx);
    }
    if (y - BALL_R < WALL_TOP) return { x, y };
    for (const br of st.bricks) {
      if (
        x >= br.x - BALL_R &&
        x <= br.x + br.w + BALL_R &&
        y >= br.y - BALL_R &&
        y <= br.y + br.h + BALL_R
      ) {
        return { x, y };
      }
    }
  }
  return { x, y };
}

/** Brick Blitz — seeded paddle breaker. Mouse/touch or arrows to move. */
export function BrickBlitzGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<GameState>(newState());
  const keysRef = useRef({ left: false, right: false });
  const lastClickAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(1);
  const [wave, setWave] = useState(1);
  const [dailyBest, setDailyBest] = useState(0);
  const [perfect, setPerfect] = useState(false);

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
    setLives(st.lives);
    setCombo(st.combo);
    setWave(st.wave);
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      const st = stateRef.current;
      if (st.phase !== "playing") return;
      if (won) {
        const bonus = 2000 + st.lives * 500;
        st.score += bonus;
      }
      st.phase = won ? "won" : "over";
      st.finalScore = st.score;
      if (st.score > loadBest()) {
        saveBest(st.score);
        setBest(st.score);
      }
      if (st.score > loadDaily(st.seed)) {
        saveDaily(st.seed, st.score);
      }
      if (won && !loadPerfect(st.seed)) savePerfect(st.seed);
      if (won) setPerfect(true);
      setDailyBest(loadDaily(st.seed));
      syncHud();
    },
    [syncHud],
  );

  const resetBall = useCallback(() => {
    const st = stateRef.current;
    st.launched = false;
    st.combo = 1;
    st.balls = [
      {
        x: st.paddleX + st.paddleW / 2,
        y: PADDLE_Y - BALL_R - 1,
        vx: 0,
        vy: 0,
        fire: false,
      },
    ];
  }, []);

  const launch = useCallback(() => {
    const st = stateRef.current;
    if (st.launched || st.phase === "over" || st.phase === "won") return;
    st.launched = true;
    st.phase = "playing";
    const b = st.balls[0];
    // Aim from the aim point (mouse) toward the launch direction.
    const dx = st.aim.x - b.x;
    const dy = st.aim.y - b.y;
    const len = Math.hypot(dx, dy) || 1;
    const tilt = Math.max(-0.85, Math.min(0.85, dx / len) * 0.9);
    b.vx = tilt * BASE_SPEED * 0.6;
    b.vy = -Math.sqrt(Math.max(0, BASE_SPEED ** 2 - b.vx ** 2));
    b.fire = false;
    syncHud();
  }, [syncHud]);

  const restart = useCallback(() => {
    stateRef.current = newState();
    setWave(1);
    syncHud();
  }, [syncHud]);

  const spawnFalling = useCallback((x: number, y: number, kind: PowerKind) => {
    const st = stateRef.current;
    st.falling.push({ x, y, vy: 90, kind, w: 30, h: 18 });
  }, []);

  const applyPower = useCallback((kind: PowerKind) => {
    const st = stateRef.current;
    const now = performance.now();
    switch (kind) {
      case "life":
        st.lives = Math.min(6, st.lives + 1);
        setLives(st.lives);
        break;
      case "expand":
        st.powerUntil.expand = now + 12000;
        st.paddleW = PADDLE_BASE * 1.5;
        break;
      case "fire":
        st.powerUntil.fire = now + 9000;
        break;
      case "laser":
        st.powerUntil.laser = now + 9000;
        break;
      case "slow":
        st.powerUntil.slow = now + 9000;
        break;
      case "fast":
        st.powerUntil.fast = now + 9000;
        break;
      case "multi":
        st.powerUntil.multi = now + 9000;
        // Split every live ball into two extra divergent balls.
        const extra: Ball[] = [];
        for (const b of st.balls) {
          const sp = Math.hypot(b.vx, b.vy) || BASE_SPEED;
          for (const a of [-0.5, 0.5]) {
            const ang = Math.atan2(b.vy, b.vx) + a;
            extra.push({
              x: b.x,
              y: b.y,
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp,
              fire: false,
            });
          }
        }
        st.balls.push(...extra);
        break;
    }
    addPopup(st.paddleX + st.paddleW / 2, PADDLE_Y - 24, POWER_LABELS[kind], POWER_COLORS[kind]);
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
    if (st.particles.length > 220) st.particles.splice(0, st.particles.length - 220);
  }, []);

  // Expanding ring pulse when the ball smacks a wall.
  const spawnRipple = useCallback((x: number, y: number, color = "#9cc2e0") => {
    const st = stateRef.current;
    st.ripples.push({ x, y, born: performance.now(), life: 420, color });
    if (st.ripples.length > 12) st.ripples.shift();
  }, []);

  // Laser: the topmost brick in a column (used by the laser power-up).
  const laserColumn = useCallback((x: number) => {
    const st = stateRef.current;
    let best: { idx: number; y: number } | null = null;
    for (let i = 0; i < st.bricks.length; i++) {
      const br = st.bricks[i];
      if (x >= br.x - BALL_R && x <= br.x + br.w + BALL_R) {
        if (!best || br.y < best.y) best = { idx: i, y: br.y };
      }
    }
    if (best) {
      const br = st.bricks[best.idx];
      const col = `hsl(${br.hue} 85% 60%)`;
      st.bricks.splice(best.idx, 1);
      st.score += (br.kind === "steel" ? 0 : br.points) * st.combo;
      setScore(st.score);
      burst(x, br.y + br.h / 2, col, 8);
      addPopup(x, br.y, "Laser", "#fbbf24");
      st.shakeAmt = Math.min(8, st.shakeAmt + 3);
      if (br.pu) spawnFalling(br.x + br.w / 2, br.y + br.h / 2, br.pu);
      if (st.bricks.length === 0) finish(true);
    }
  }, [addPopup, burst, finish, spawnFalling]);

  function step(st: GameState, dt: number) {
    const now = performance.now();

    // Paddle follows keys.
    if (keysRef.current.left) st.paddleX -= 460 * dt;
    if (keysRef.current.right) st.paddleX += 460 * dt;
    st.paddleX = Math.max(0, Math.min(W - st.paddleW, st.paddleX));

    // Expire the expand power-up.
    if (st.powerUntil.expand && now > st.powerUntil.expand) {
      delete st.powerUntil.expand;
      st.paddleW = PADDLE_BASE;
      st.paddleX = Math.max(0, Math.min(W - st.paddleW, st.paddleX));
    }
    // Expire multi / fire / laser / slow / fast timers.
    for (const k of ["fire", "laser", "slow", "fast", "multi"] as PowerKind[]) {
      if (st.powerUntil[k] && now > st.powerUntil[k]!) delete st.powerUntil[k];
    }

    // Descending hazard wall (time pressure) — speeds up each wave.
    if (st.launched) {
      const speed = HAZARD_BASE_SPEED + (st.wave - 1) * HAZARD_WAVE_BOOST;
      st.hazardY += speed * dt;
      if (st.hazardY >= PADDLE_Y - 8) {
        finish(false);
        return;
      }
    }

    // Falling power-ups drop and are caught by the paddle.
    for (const p of st.falling) {
      p.y += p.vy * dt;
      if (
        p.y + p.h / 2 >= PADDLE_Y &&
        p.y + p.h / 2 <= PADDLE_Y + PADDLE_H + 14 &&
        p.x >= st.paddleX - 10 &&
        p.x <= st.paddleX + st.paddleW + 10
      ) {
        p.y = 99999; // mark caught
        applyPower(p.kind);
      }
    }
    st.falling = st.falling.filter((p) => p.y < H);

    // Moving bricks oscillate horizontally.
    for (const br of st.bricks) {
      if (br.kind === "moving") {
        br.x += br.vx * dt;
        if (br.x > br.homeX + 7) br.vx = -Math.abs(br.vx);
        if (br.x < br.homeX - 7) br.vx = Math.abs(br.vx);
      }
    }

    const fire = !!st.powerUntil.fire;
    const fast = !!st.powerUntil.fast;
    const slow = !!st.powerUntil.slow;

    const balls = st.balls;
    if (!st.launched) {
      const b = balls[0];
      b.x = st.paddleX + st.paddleW / 2;
      b.y = PADDLE_Y - BALL_R - 1;
      return;
    }

    for (const b of balls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Walls (stone frame — bounce at the inner wall faces, with impact FX).
      if (b.x - BALL_R < WALL_L) {
        b.x = WALL_L + BALL_R;
        b.vx = Math.abs(b.vx);
        spawnRipple(WALL_L, b.y);
        burst(WALL_L, b.y, WALL_FACE, 5);
        st.shakeAmt = Math.min(6, st.shakeAmt + 1.5);
      }
      if (b.x + BALL_R > WALL_R) {
        b.x = WALL_R - BALL_R;
        b.vx = -Math.abs(b.vx);
        spawnRipple(WALL_R, b.y);
        burst(WALL_R, b.y, WALL_FACE, 5);
        st.shakeAmt = Math.min(6, st.shakeAmt + 1.5);
      }
      if (b.y - BALL_R < WALL_TOP) {
        b.y = WALL_TOP + BALL_R;
        b.vy = Math.abs(b.vy);
        spawnRipple(b.x, WALL_TOP);
        burst(b.x, WALL_TOP, WALL_FACE, 5);
        st.shakeAmt = Math.min(6, st.shakeAmt + 1.5);
      }

      // Paddle.
      if (
        b.vy > 0 &&
        b.y + BALL_R >= PADDLE_Y &&
        b.y + BALL_R <= PADDLE_Y + PADDLE_H + 12 &&
        b.x >= st.paddleX - BALL_R &&
        b.x <= st.paddleX + st.paddleW + BALL_R
      ) {
        const rel = Math.max(
          -1,
          Math.min(1, (b.x - (st.paddleX + st.paddleW / 2)) / (st.paddleW / 2)),
        );
        let speed = Math.hypot(b.vx, b.vy);
        if (slow) speed = Math.max(120, speed * 0.82);
        if (fast) speed = Math.min(MAX_SPEED + 120, speed * 1.12);
        b.vx = rel * 0.85 * speed;
        b.vy = -Math.sqrt(Math.max(0, speed * speed - b.vx * b.vx));
        b.y = PADDLE_Y - BALL_R;
        b.fire = fire;
        st.combo = 1;
        setCombo(1);
      }

      // Bricks — closest hit per frame.
      let hitIdx = -1;
      let hitDx = 0;
      let hitDy = 0;
      let bestDist = Infinity;
      for (let i = 0; i < st.bricks.length; i++) {
        const br = st.bricks[i];
        const cx = Math.max(br.x, Math.min(b.x, br.x + br.w));
        const cy = Math.max(br.y, Math.min(b.y, br.y + br.h));
        const dx = b.x - cx;
        const dy = b.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= BALL_R * BALL_R && d2 < bestDist) {
          bestDist = d2;
          hitIdx = i;
          hitDx = dx;
          hitDy = dy;
        }
      }

      if (hitIdx >= 0) {
        const br = st.bricks[hitIdx];
        if (Math.abs(hitDx) > Math.abs(hitDy)) {
          b.vx = hitDx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
          b.x = hitDx > 0 ? br.x + br.w + BALL_R : br.x - BALL_R;
        } else {
          b.vy = hitDy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
          b.y = hitDy > 0 ? br.y + br.h + BALL_R : br.y - BALL_R;
        }

        const steel = br.kind === "steel" && !fire;
        const mult = fast ? 2 : 1;
        if (!steel) {
          br.hp -= fire ? 999 : 1;
          if (br.hp <= 0) {
            const col = `hsl(${br.hue} 85% 58%)`;
            st.bricks.splice(hitIdx, 1);
            st.destroyed += 1;
            st.score += br.points * st.combo * mult;
            burst(b.x, b.y, col, 9);
            st.shakeAmt = Math.min(8, st.shakeAmt + 2.5);
            if (br.pu) spawnFalling(br.x + br.w / 2, br.y + br.h / 2, br.pu);
          } else {
            st.score += 5 * st.combo * mult;
            burst(b.x, b.y, `hsl(${br.hue} 85% 55%)`, 4);
          }
          st.combo += 1;
          setScore(st.score);
          setCombo(st.combo);

          // Ball speeds up as more bricks are destroyed (capped by the
          // destroyed-count-scaled max speed).
          const csp = Math.hypot(b.vx, b.vy);
          const cap = Math.min(
            MAX_SPEED + st.destroyed * DESTROY_SPEED_STEP,
            MAX_SPEED + MAX_SPEED_GROWTH,
          );
          const effCap = slow ? cap * 0.72 : cap;
          if (csp < effCap && csp > 0) {
            const scale = Math.min((csp + 5) / csp, effCap / csp);
            b.vx *= scale;
            b.vy *= scale;
          }
        }
      }

      // Ball lost only when every ball is gone (handled below).
    }

    // Remove balls that fell off the bottom.
    const alive = st.balls.filter((b) => b.y - BALL_R <= H);
    if (alive.length !== st.balls.length) {
      st.balls = alive;
      if (alive.length === 0) {
        st.lives -= 1;
        if (st.lives <= 0) {
          finish(false);
        } else {
          setLives(st.lives);
          resetBall();
        }
      }
    }

    // Wave complete — advance to a fresh, harder wall.
    if (st.phase === "playing" && st.bricks.length === 0) {
      const next = st.wave + 1;
      const fresh = newState(next);
      st.bricks = fresh.bricks;
      st.wave = next;
      st.hazardY = HAZARD_START;
      st.score += 1500 + st.lives * 300;
      addPopup(W / 2, 120, "WAVE " + next + "!", "#f0abfc");
      addPopup(W / 2, 150, "+" + (1500 + st.lives * 300), "#fde68a");
      st.shakeAmt = Math.min(10, st.shakeAmt + 6);
      setScore(st.score);
      setWave(next);
      syncHud();
    }
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

    const loop = (t: number) => {
      const st = stateRef.current;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (st.phase === "playing") step(st, dt);
      const now = performance.now();

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

      // Glossy blue playfield (matches pinball + Bubble Pop).
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

      // Stone wall frame around the blue playfield. The ball bounces off the
      // inner faces (WALL_L / WALL_R / WALL_TOP) with a ripple + particles.
      const drawWallBand = (x: number, y: number, w: number, h: number) => {
        if (w <= 0 || h <= 0) return;
        const g = c.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, WALL_FACE);
        g.addColorStop(1, "#5f6b78");
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
        // Brick pattern: mortar lines in an offset running-bond.
        c.strokeStyle = WALL_MORTAR;
        c.lineWidth = 1.5;
        const bh = 11;
        const bw = 26;
        for (let ry = y; ry < y + h; ry += bh) {
          c.beginPath();
          c.moveTo(x, ry);
          c.lineTo(x + w, ry);
          c.stroke();
          const row = Math.round((ry - y) / bh);
          const off = row % 2 ? bw / 2 : 0;
          for (let rx = x - off; rx < x + w; rx += bw) {
            if (rx > x) {
              c.beginPath();
              c.moveTo(rx, ry);
              c.lineTo(rx, Math.min(ry + bh, y + h));
              c.stroke();
            }
          }
        }
        // Inner edge highlight so the ball visibly hits a solid frame.
        c.strokeStyle = "rgba(255,255,255,0.45)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y + h);
        c.lineTo(x, y);
        c.lineTo(x + w, y);
        c.stroke();
      };
      // Three bands framing the blue playfield: left, right, top.
      drawWallBand(0, 0, WALL_L, H);
      drawWallBand(WALL_R, 0, W - WALL_R, H);
      drawWallBand(WALL_L, 0, WALL_R - WALL_L, WALL_TOP);

      // Grid (steel-blue).
      c.strokeStyle = "rgba(120,160,200,0.12)";
      c.lineWidth = 1;
      for (let gx = WALL_L; gx <= WALL_R; gx += 48) {
        c.beginPath();
        c.moveTo(gx, WALL_TOP);
        c.lineTo(gx, H - 8);
        c.stroke();
      }

      // Descending hazard wall (glowing band).
      if (st.launched && st.hazardY > TOP - 10) {
        const hy = Math.min(st.hazardY, H);
        const hg = c.createLinearGradient(0, hy - 26, 0, hy);
        hg.addColorStop(0, "rgba(244,114,182,0.06)");
        hg.addColorStop(1, "rgba(244,114,182,0.75)");
        c.fillStyle = hg;
        c.fillRect(16, hy - 26, W - 32, 26);
        c.strokeStyle = "rgba(251,146,60,0.9)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(18, hy);
        c.lineTo(W - 18, hy);
        c.stroke();
      }

      // Active power-up tint bands.
      if (st.powerUntil.fire && now < st.powerUntil.fire!) {
        c.fillStyle = "rgba(251,113,133,0.06)";
        c.fillRect(16, 30, W - 32, H - 34);
      } else if (st.powerUntil.slow && now < st.powerUntil.slow!) {
        c.fillStyle = "rgba(52,211,153,0.05)";
        c.fillRect(16, 30, W - 32, H - 34);
      }

      // Bricks.
      for (const br of st.bricks) {
        const face = brickFace(br, now);
        // Dark side face (3D depth).
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.fillRect(br.x + 1, br.y + 2, br.w, br.h);
        // Top face.
        c.fillStyle = face;
        c.fillRect(br.x, br.y, br.w, br.h);
        // Gloss top strip.
        c.fillStyle = "rgba(255,255,255,0.26)";
        c.fillRect(br.x, br.y, br.w, 4);
        // Metal/armored rim.
        if (br.kind === "steel" || br.kind === "armored" || br.hp > 1) {
          c.strokeStyle = "rgba(255,255,255,0.7)";
          c.lineWidth = 1.5;
          c.strokeRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2);
        }
        // HP pips for multi-hit.
        if (br.hp > 1 && br.kind !== "steel") {
          c.fillStyle = "rgba(255,255,255,0.85)";
          for (let h = 0; h < Math.min(br.hp, 3); h++) {
            c.fillRect(br.x + br.w / 2 - (Math.min(br.hp, 3) * 3) / 2 + h * 3, br.y + br.h - 5, 2, 2);
          }
        }
      }

      // Aim / ghost launch line while the ball is resting.
      if (!st.launched && (st.phase === "ready" || st.phase === "playing")) {
        const b = st.balls[0];
        const hit = ghostHit(st, b.x, b.y);
        c.strokeStyle = "rgba(125,211,252,0.5)";
        c.lineWidth = 1.5;
        c.setLineDash([6, 6]);
        c.beginPath();
        c.moveTo(b.x, b.y);
        c.lineTo(hit.x, hit.y);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "rgba(125,211,252,0.7)";
        c.beginPath();
        c.arc(hit.x, hit.y, 3, 0, Math.PI * 2);
        c.fill();
      }

      // Falling power-ups.
      for (const p of st.falling) {
        const col = POWER_COLORS[p.kind];
        c.fillStyle = "rgba(0,0,0,0.35)";
        c.beginPath();
        c.roundRect(p.x - p.w / 2 + 2, p.y - p.h / 2 + 3, p.w, p.h, 5);
        c.fill();
        c.fillStyle = col;
        c.beginPath();
        c.roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 5);
        c.fill();
        c.strokeStyle = "rgba(255,255,255,0.6)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 5);
        c.stroke();
        c.fillStyle = "#0b1220";
        c.font = "bold 9px ui-monospace, monospace";
        c.textAlign = "center";
        c.fillText(POWER_LABELS[p.kind], p.x, p.y + 3);
      }

      // Paddle (steel + neon accent stripe).
      const padG = c.createLinearGradient(st.paddleX, PADDLE_Y, st.paddleX, PADDLE_Y + PADDLE_H);
      padG.addColorStop(0, "#e2e8f0");
      padG.addColorStop(1, "#94a3b8");
      c.fillStyle = padG;
      c.beginPath();
      c.roundRect(st.paddleX, PADDLE_Y, st.paddleW, PADDLE_H, 6);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.5)";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(st.paddleX, PADDLE_Y, st.paddleW, PADDLE_H, 6);
      c.stroke();
      c.fillStyle = "#38bdf8";
      c.fillRect(st.paddleX + 4, PADDLE_Y + 4, st.paddleW - 8, 3);

      // Laser sight when active.
      if (st.powerUntil.laser && now < st.powerUntil.laser!) {
        c.strokeStyle = "rgba(251,191,36,0.5)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(st.paddleX + st.paddleW / 2, PADDLE_Y);
        c.lineTo(st.paddleX + st.paddleW / 2, TOP - 10);
        c.stroke();
      }

      // Balls (chrome spheres / fireballs).
      for (const b of st.balls) {
        if (b.y - BALL_R > H) continue;
        const fg = c.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
        if (b.fire) {
          fg.addColorStop(0, "#fff1f2");
          fg.addColorStop(1, "#fb7185");
        } else {
          fg.addColorStop(0, "#ffffff");
          fg.addColorStop(1, "#94a3b8");
        }
        c.fillStyle = fg;
        c.beginPath();
        c.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.beginPath();
        c.arc(b.x - 2, b.y - 2, 2, 0, Math.PI * 2);
        c.fill();
      }

      // Wall-impact ripples (expanding rings).
      for (const r of st.ripples) {
        const p = (now - r.born) / r.life;
        if (p >= 1) continue;
        c.globalAlpha = Math.max(0, 1 - p);
        c.strokeStyle = r.color;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(r.x, r.y, 6 + p * 34, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;

      // Particles.
      for (const p of st.particles) {
        const a = 1 - (now - p.born) / p.life;
        c.globalAlpha = Math.max(0, a);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      // Floating popups.
      for (const p of st.popups) {
        const age = now - p.born;
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
  }, [step, finish, resetBall, brickFace, ghostHit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard.
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        const st = stateRef.current;
        if (st.phase === "over" || st.phase === "won") restart();
        else if (st.launched && st.powerUntil.laser && performance.now() < st.powerUntil.laser!) {
          laserColumn(st.paddleX + st.paddleW / 2);
        } else launch();
      }
      if (e.code === "ArrowLeft") keysRef.current.left = true;
      if (e.code === "ArrowRight") keysRef.current.right = true;
    }
    function up(e: KeyboardEvent) {
      if (e.code === "ArrowLeft") keysRef.current.left = false;
      if (e.code === "ArrowRight") keysRef.current.right = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [launch, restart, laserColumn]);

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const st = stateRef.current;
    st.paddleX = Math.max(0, Math.min(W - st.paddleW, x - st.paddleW / 2));
    st.aim = { x, y };
    if (!st.launched && (st.phase === "ready" || st.phase === "playing")) {
      const b = st.balls[0];
      b.x = st.paddleX + st.paddleW / 2;
    }
  }

  function onCanvasClick(extra?: Partial<{ clientX: number; clientY: number }>) {
    const now = performance.now();
    const st = stateRef.current;
    // Use the canvas rect from the underlying element when available.
    let x = st.paddleX + st.paddleW / 2;
    let y = PADDLE_Y;
    const canvas = canvasRef.current;
    if (canvas && extra && typeof extra.clientX === "number" && typeof extra.clientY === "number") {
      const rect = canvas.getBoundingClientRect();
      x = ((extra.clientX - rect.left) / rect.width) * W;
      y = ((extra.clientY - rect.top) / rect.height) * H;
    }
    st.aim = { x, y };
    if (st.phase === "over" || st.phase === "won") {
      lastClickAtRef.current = now;
      restart();
      return;
    }
    // Ignore the click that passes through right after an overlay unmounts.
    if (now - lastClickAtRef.current < 300) return;
    lastClickAtRef.current = now;
    // Clicking fires the laser when active.
    if (st.launched && st.powerUntil.laser && now < st.powerUntil.laser!) {
      laserColumn(x);
      return;
    }
    launch();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
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
          <span className="font-display text-xs text-sky-300">Wave {wave}</span>
          <span className="text-red-400">
            {"❤".repeat(Math.max(0, lives))}
          </span>
          <span className="font-display text-zinc-200">Best: {best}</span>
        </div>
      </div>

      <div className="flex w-full max-w-md items-center justify-between text-xs">
        <span className="text-zinc-500">
          Aim with the mouse, click/Space to launch.
        </span>
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
          className="block cursor-pointer"
          style={{ width: W, height: H, touchAction: "none" }}
        />
        {phase === "ready" && (
          <button
            onClick={onCanvasClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 text-center"
          >
            <span className="text-3xl">🧱</span>
            <span className="font-display text-lg tracking-wide">Brick Blitz</span>
            <span className="text-sm text-zinc-400">
              Aim with the mouse, click or Space to launch.
              <br />
              Chain hits to build your combo. Beat the descending wall!
              <br />
              Catch falling power-ups: fire, multi, laser, more.
            </span>
            <span className="arcade-chip mt-2">Insert coin · Play</span>
          </button>
        )}
        {phase === "over" && (
          <button
            onClick={onCanvasClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 text-center"
          >
            <span className="text-3xl">💥</span>
            <span className="font-display text-xl tracking-wide">Wall wins!</span>
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
            onClick={onCanvasClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 text-center"
          >
            <span className="text-3xl">🏆</span>
            <span className="font-display text-xl tracking-wide">Wall cleared!</span>
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
      </div>

      <p className="text-center text-xs text-zinc-600">
        Free practice · daily seeded wall (the exact wall tournaments will
        use) · paid rounds 0.10 USDC coming soon
      </p>
    </div>
  );
}
