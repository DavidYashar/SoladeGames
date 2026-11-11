"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PIN, PIN_SCORE } from "@/lib/games/pinball";

/* ---------- physics constants ---------- */

const R = PIN.ballR;
const GRAVITY = 1120;
const SUB_DT = 1 / 240; // fixed 240 Hz physics — deterministic
const MAX_SPEED = 1600;
const MAX_BALLS = 3;
const BEST_KEY = "imarket:pinball:best";

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

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number; // rad/s, + = clockwise (canvas y-down)
  rot: number; // visual rotation angle (rad) for the rolling marker
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  born: number;
}

interface FlipperState {
  angle: number;
  omega: number;
  pressed: boolean;
  isLeft: boolean;
}

interface SimState {
  ball: BallState;
  flippers: FlipperState[];
  resting: boolean;
  charging: boolean;
  power: number;
  ballIdx: number; // 1-based current ball
  score: number;
  targetLit: boolean[];
  bumperFlashAt: number[];
  targetFlashAt: number[];
  triangleFlashAt: number[];
  jackpotFlashAt: number;
  drainAt: number;
  trail: { x: number; y: number }[];
  popups: ScorePopup[];
  shakeAmt: number;
  stallT: number;
  phase: "ready" | "playing" | "over";
  finalScore: number;
}

type Phase = "ready" | "playing" | "over";

function laneBall(): BallState {
  return { x: PIN.lane.x, y: PIN.lane.restY, vx: 0, vy: 0, spin: 0, rot: 0 };
}

function newSim(): SimState {
  return {
    ball: laneBall(),
    flippers: [
      { angle: PIN.flippers.left.rest, omega: 0, pressed: false, isLeft: true },
      { angle: PIN.flippers.right.rest, omega: 0, pressed: false, isLeft: false },
    ],
    resting: true,
    charging: false,
    power: 0,
    ballIdx: 1,
    score: 0,
    targetLit: [false, false, false, false, false, false],
    bumperFlashAt: [0, 0, 0],
    targetFlashAt: [0, 0, 0, 0, 0, 0],
    triangleFlashAt: [0, 0, 0],
    jackpotFlashAt: 0,
    drainAt: 0,
    trail: [],
    popups: [],
    shakeAmt: 0,
    stallT: 0,
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

/* ---------- collision math (m = 1, I = 0.4 m r²) ---------- */

function collideSeg(
  b: BallState,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  e: number,
  pvx = 0,
  pvy = 0,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((b.x - ax) * dx + (b.y - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  let nx = b.x - cx;
  let ny = b.y - cy;
  let d = Math.hypot(nx, ny);
  if (d >= R) return 0;
  if (d < 0.001) {
    nx = -dy / Math.sqrt(l2);
    ny = dx / Math.sqrt(l2);
    d = 0.001;
  }
  nx /= d;
  ny /= d;
  b.x = cx + nx * R;
  b.y = cy + ny * R;
  const rvx = b.vx - pvx;
  const rvy = b.vy - pvy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const jn = -(1 + e) * vn;
  b.vx += jn * nx;
  b.vy += jn * ny;
  // Coulomb friction with spin coupling.
  const tx = -ny;
  const ty = nx;
  const vt = (b.vx - pvx) * tx + (b.vy - pvy) * ty + b.spin * R;
  const mu = 0.14;
  let jt = -vt / 3.5;
  const jtMax = mu * Math.abs(jn);
  jt = Math.max(-jtMax, Math.min(jtMax, jt));
  b.vx += jt * tx;
  b.vy += jt * ty;
  b.spin += jt / (0.4 * R);
  return Math.abs(jn);
}

function collideCircle(
  b: BallState,
  cx: number,
  cy: number,
  cr: number,
  e: number,
  cvx = 0,
  cvy = 0,
): number {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d = Math.hypot(dx, dy) || 0.001;
  const rr = cr + R;
  if (d >= rr) return 0;
  const nx = dx / d;
  const ny = dy / d;
  b.x = cx + nx * rr;
  b.y = cy + ny * rr;
  const rvx = b.vx - cvx;
  const rvy = b.vy - cvy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const jn = -(1 + e) * vn;
  b.vx += jn * nx;
  b.vy += jn * ny;
  const tx = -ny;
  const ty = nx;
  const vt = (b.vx - cvx) * tx + (b.vy - cvy) * ty + b.spin * R;
  const mu = 0.15;
  let jt = -vt / 3.5;
  const jtMax = mu * Math.abs(jn);
  jt = Math.max(-jtMax, Math.min(jtMax, jt));
  b.vx += jt * tx;
  b.vy += jt * ty;
  b.spin += jt / (0.4 * R);
  return Math.abs(jn);
}

/** Flipper = rotating segment. Contact point velocity comes from ω × r. */
function collideFlipper(b: BallState, f: FlipperState): number {
  const cfg = f.isLeft ? PIN.flippers.left : PIN.flippers.right;
  const px = cfg.pivotX;
  const py = cfg.pivotY;
  const tipX = px + cfg.len * Math.cos(f.angle);
  const tipY = py + cfg.len * Math.sin(f.angle);

  const dx = tipX - px;
  const dy = tipY - py;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((b.x - px) * dx + (b.y - py) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = px + dx * t;
  const cy = py + dy * t;
  let nx = b.x - cx;
  let ny = b.y - cy;
  let d = Math.hypot(nx, ny);

  let hit = 0;
  if (d < R) {
    if (d < 0.001) {
      nx = -dy / Math.sqrt(l2);
      ny = dx / Math.sqrt(l2);
      d = 0.001;
    }
    nx /= d;
    ny /= d;
    b.x = cx + nx * R;
    b.y = cy + ny * R;
    const vfx = -f.omega * (cy - py);
    const vfy = f.omega * (cx - px);
    const rvx = b.vx - vfx;
    const rvy = b.vy - vfy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const jn = -(1 + 0.55) * vn;
      b.vx += jn * nx;
      b.vy += jn * ny;
      const tx = -ny;
      const ty = nx;
      const vt = (b.vx - vfx) * tx + (b.vy - vfy) * ty + b.spin * R;
      const mu = 0.25;
      let jt = -vt / 3.5;
      const jtMax = mu * Math.abs(jn);
      jt = Math.max(-jtMax, Math.min(jtMax, jt));
      b.vx += jt * tx;
      b.vy += jt * ty;
      b.spin += jt / (0.4 * R);
      hit = Math.abs(jn);
    }
  }

  // Tip + pivot caps.
  const vtx = -f.omega * (tipY - py);
  const vty = f.omega * (tipX - px);
  const th = collideCircle(b, tipX, tipY, 9, 0.55, vtx, vty);
  const ph = collideCircle(b, px, py, 7, 0.4);
  return Math.max(hit, th, ph);
}

/* ---------- audio ---------- */

function beep(
  actx: AudioContext | null,
  freq: number,
  type: OscillatorType,
  dur: number,
  gain: number,
  endFreq?: number,
) {
  if (!actx) return;
  try {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, actx.currentTime + dur);
    g.gain.setValueAtTime(gain, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch {
    // audio unavailable
  }
}

/* ---------- component ---------- */

export function PinballGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const simRef = useRef<SimState>(newSim());
  const actxRef = useRef<AudioContext | null>(null);
  const powerPctRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [ballIdx, setBallIdx] = useState(1);
  const [power, setPower] = useState(0);
  // Canvas display size — auto-fit so the board + buttons stay on screen.
  const [board, setBoard] = useState<{ w: number; h: number }>({
    w: PIN.W,
    h: PIN.H,
  });

  useEffect(() => {
    setBest(loadBest());
  }, []);

  // Fit the board into the space left below the HUD and above the touch
  // controls, so users never have to scroll to reach the buttons.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const fit = () => {
      const avail = el.clientWidth;
      const availH = el.clientHeight;
      if (avail <= 0 || availH <= 0) return;
      const ratio = PIN.W / PIN.H;
      let w = avail;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      setBoard({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const syncHud = useCallback(() => {
    const s = simRef.current;
    setPhase(s.phase);
    setScore(s.score);
    setBallIdx(s.ballIdx);
  }, []);

  const addScore = useCallback((n: number) => {
    const s = simRef.current;
    s.score += n;
    setScore(s.score);
  }, []);

  const addPopup = useCallback((x: number, y: number, text: string) => {
    const s = simRef.current;
    s.popups.push({ x, y, text, born: performance.now() });
    if (s.popups.length > 8) s.popups.shift();
  }, []);

  const restart = useCallback(() => {
    simRef.current = newSim();
    simRef.current.phase = "playing";
    powerPctRef.current = 0;
    syncHud();
    setPower(0);
  }, [syncHud]);

  const startGame = useCallback(() => {
    const s = simRef.current;
    if (s.phase === "over") restart();
    else if (s.phase === "ready") {
      s.phase = "playing";
      syncHud();
    }
  }, [restart, syncHud]);

  const launch = useCallback(() => {
    const s = simRef.current;
    if (!s.resting || s.phase !== "playing") return;
    const b = s.ball;
    b.vy = -(300 + 1000 * s.power);
    b.vx = 0;
    b.spin = 0;
    b.rot = 0;
    s.resting = false;
    s.charging = false;
    s.power = 0;
    powerPctRef.current = 0;
    setPower(0);
    beep(actxRef.current, 160, "sawtooth", 0.25, 0.12, 420);
  }, []);

  function loseBall() {
    const s = simRef.current;
    s.ballIdx += 1;
    s.trail = [];
    beep(actxRef.current, 130, "sawtooth", 0.3, 0.15, 70);
    if (s.ballIdx > MAX_BALLS) {
      s.phase = "over";
      s.finalScore = s.score;
      if (s.score > loadBest()) {
        saveBest(s.score);
        setBest(s.score);
      }
      beep(actxRef.current, 220, "square", 0.5, 0.1, 90);
      syncHud();
      return;
    }
    s.resting = true;
    s.charging = false;
    s.power = 0;
    powerPctRef.current = 0;
    setPower(0);
    s.ball = laneBall();
    syncHud();
  }

  function step(dt: number) {
    const s = simRef.current;
    const now = performance.now();
    const b = s.ball;

    // Flippers.
    for (const f of s.flippers) {
      const cfg = f.isLeft ? PIN.flippers.left : PIN.flippers.right;
      const target = f.pressed ? cfg.pressed : cfg.rest;
      const maxOmega = f.pressed ? 22 : 22;
      const delta = target - f.angle;
      const stepAngle = Math.sign(delta) * Math.min(Math.abs(delta), maxOmega * dt);
      f.angle += stepAngle;
      f.omega = stepAngle / dt;
    }

    if (s.phase !== "playing") return;

    // Plunger charging.
    if (s.resting) {
      if (s.charging) {
        s.power = Math.min(1, s.power + dt * 0.85);
        const pct = Math.round(s.power * 100);
        if (pct !== powerPctRef.current) {
          powerPctRef.current = pct;
          setPower(s.power);
        }
      }
      return;
    }

    // Integrate.
    b.vy += GRAVITY * dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) {
      b.vx = (b.vx / sp) * MAX_SPEED;
      b.vy = (b.vy / sp) * MAX_SPEED;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.spin * dt;

    // Walls + slingshots.
    for (const w of PIN.walls) collideSeg(b, w.ax, w.ay, w.bx, w.by, w.e);
    // One-way gate across the lane exit: solid when the ball moves down or
    // rolls on it, open when it rises (launch passes through). Sloped down-
    // left, meeting the lane wall exactly — no overhang, so balls can't
    // re-enter the lane; they roll off the left end into open play.
    if (b.vy > -30) collideSeg(b, 350, 250, 400, 238, 0.3);
    for (const sl of PIN.slings) {
      const hit = collideSeg(b, sl.ax, sl.ay, sl.bx, sl.by, sl.e);
      if (hit > 90) {
        addScore(PIN_SCORE.sling);
        addPopup((sl.ax + sl.bx) / 2, (sl.ay + sl.by) / 2 - 8, "+" + PIN_SCORE.sling);
        s.shakeAmt = Math.min(6, s.shakeAmt + 2);
        beep(actxRef.current, 740, "square", 0.05, 0.08);
      }
    }

    // Bumper triangles — kickers that boost the ball out in a random direction.
    for (let i = 0; i < PIN.triangles.length; i++) {
      const t = PIN.triangles[i];
      // Reflect off the triangle edges as a solid body.
      let hit = collideSeg(b, t.a.x, t.a.y, t.b.x, t.b.y, 0.6);
      hit = Math.max(hit, collideSeg(b, t.b.x, t.b.y, t.c.x, t.c.y, 0.6));
      hit = Math.max(hit, collideSeg(b, t.c.x, t.c.y, t.a.x, t.a.y, 0.6));
      // On contact, kick the ball out hard in a random direction (pop-bumper style).
      if (hit > 40 && now - (s.triangleFlashAt?.[i] ?? 0) > 60) {
        s.triangleFlashAt[i] = now;
        const gx = (t.a.x + t.b.x + t.c.x) / 3;
        const gy = (t.a.y + t.b.y + t.c.y) / 3;
        // Launch away from the triangle's centroid, with a random spread.
        const away = Math.atan2(b.y - gy, b.x - gx);
        const ang = away + (Math.random() - 0.5) * Math.PI * 1.2;
        const kick = 760;
        b.vx = Math.cos(ang) * kick;
        b.vy = Math.sin(ang) * kick;
        b.spin = (Math.random() - 0.5) * 30;
        addScore(PIN_SCORE.triangle);
        addPopup(gx, gy - 16, "+" + PIN_SCORE.triangle);
        s.shakeAmt = Math.min(8, s.shakeAmt + 3.5);
        beep(actxRef.current, 1000, "square", 0.06, 0.12);
        beep(actxRef.current, 1500, "square", 0.05, 0.08);
      }
    }

    // Targets.
    for (let i = 0; i < PIN.targets.length; i++) {
      const t = PIN.targets[i];
      const hit = collideCircle(b, t.x, t.y, t.r, 0.65);
      if (hit > 0) {
        s.targetLit[i] = true;
        s.targetFlashAt[i] = now;
        addScore(PIN_SCORE.target);
        addPopup(t.x, t.y - 16, "+" + PIN_SCORE.target);
        beep(actxRef.current, 880, "triangle", 0.08, 0.1);
        if (s.targetLit.every(Boolean)) {
          addScore(PIN_SCORE.jackpot);
          s.jackpotFlashAt = now;
          s.targetLit = [false, false, false];
          s.shakeAmt = 7;
          addPopup(PIN.W / 2, PIN.H / 2 - 40, "JACKPOT +" + PIN_SCORE.jackpot);
          beep(actxRef.current, 1320, "triangle", 0.12, 0.12);
          beep(actxRef.current, 1760, "triangle", 0.14, 0.12);
        }
      }
    }

    // Pop bumpers.
    for (let i = 0; i < PIN.bumpers.length; i++) {
      const bu = PIN.bumpers[i];
      const dx = b.x - bu.x;
      const dy = b.y - bu.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const rr = bu.r + R;
      if (d >= rr) continue;
      const nx = dx / d;
      const ny = dy / d;
      b.x = bu.x + nx * rr;
      b.y = bu.y + ny * rr;
      const vn = b.vx * nx + b.vy * ny;
      const tangX = b.vx - vn * nx;
      const tangY = b.vy - vn * ny;
      b.vx = nx * 540 + tangX * 0.6;
      b.vy = ny * 540 + tangY * 0.6;
      if (now - s.bumperFlashAt[i] > 140) {
        s.bumperFlashAt[i] = now;
        addScore(PIN_SCORE.bumper);
        addPopup(bu.x, bu.y - 18, "+" + PIN_SCORE.bumper);
        s.shakeAmt = Math.min(6, s.shakeAmt + 2.5);
        beep(actxRef.current, 1200, "square", 0.06, 0.09);
      }
    }

    // Flippers.
    for (const f of s.flippers) collideFlipper(b, f);

    // Lane capture (ball returned to plunger).
    if (
      b.x > 352 &&
      b.x < 400 &&
      b.y > 700 &&
      Math.hypot(b.vx, b.vy) < 80 &&
      !s.resting
    ) {
      s.resting = true;
      s.charging = false;
      s.power = 0;
      powerPctRef.current = 0;
      setPower(0);
      s.ball = laneBall();
      beep(actxRef.current, 520, "sine", 0.12, 0.1);
    }

    // Drain.
    if (b.y - R > PIN.drainY) {
      s.drainAt = now;
      loseBall();
      return;
    }

    // Ball search: if the ball stalls anywhere, nudge the table after 3s.
    if (Math.hypot(b.vx, b.vy) < 8) {
      s.stallT += dt;
      if (s.stallT > 3) {
        s.stallT = 0;
        b.vx += b.x < PIN.W / 2 ? 140 : -140;
        b.vy = -220;
        beep(actxRef.current, 300, "square", 0.08, 0.07);
      }
    } else {
      s.stallT = 0;
    }
  }

  // Render loop with fixed-timestep accumulator.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = PIN.W * dpr;
    canvas.height = PIN.H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (t: number) => {
      const frame = Math.min(0.05, (t - last) / 1000);
      last = t;
      acc += frame;
      let steps = 0;
      while (acc >= SUB_DT && steps < 6) {
        step(SUB_DT);
        acc -= SUB_DT;
        steps++;
      }
      if (steps === 6) acc = 0;

      const s = simRef.current;
      const now = performance.now();

      // Trail.
      s.trail.push({ x: s.ball.x, y: s.ball.y });
      if (s.trail.length > 10) s.trail.shift();

      const c = ctxRef.current!;
      c.clearRect(0, 0, PIN.W, PIN.H);

      // Cabinet (charcoal rounded bezel).
      c.fillStyle = "#23262d";
      c.beginPath();
      c.roundRect(0, 0, PIN.W, PIN.H, 18);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.07)";
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(2, 2, PIN.W - 4, PIN.H - 4, 16);
      c.stroke();

      // Glossy blue playfield.
      const pg = c.createLinearGradient(0, 0, 0, PIN.H);
      pg.addColorStop(0, "#2b6fae");
      pg.addColorStop(0.5, "#1e5b97");
      pg.addColorStop(1, "#123b6b");
      c.fillStyle = pg;
      c.beginPath();
      c.roundRect(16, 30, PIN.W - 32, PIN.H - 34, 22);
      c.fill();
      // Gloss highlight.
      const gloss = c.createLinearGradient(0, 30, 0, 210);
      gloss.addColorStop(0, "rgba(255,255,255,0.12)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gloss;
      c.beginPath();
      c.roundRect(16, 30, PIN.W - 32, 180, 22);
      c.fill();

      // Screen shake.
      const shakeScale = s.shakeAmt;
      if (shakeScale > 0.3) {
        c.save();
        c.translate((Math.random() - 0.5) * shakeScale, (Math.random() - 0.5) * shakeScale);
      }

      const neon = (color: string, blur = 8) => {
        c.strokeStyle = color;
        c.shadowColor = color;
        c.shadowBlur = blur;
      };

      // Side rails — chunky gray walls with depth.
      for (const w of PIN.walls) {
        c.lineCap = "round";
        c.strokeStyle = "rgba(0,0,0,0.35)";
        c.lineWidth = 10;
        c.beginPath();
        c.moveTo(w.ax + 1, w.ay + 3);
        c.lineTo(w.bx + 1, w.by + 3);
        c.stroke();
        c.strokeStyle = "#9aa6b4";
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(w.ax, w.ay);
        c.lineTo(w.bx, w.by);
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.45)";
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(w.ax, w.ay - 2);
        c.lineTo(w.bx, w.by - 2);
        c.stroke();
      }
      c.lineCap = "butt";

      // Slingshots — red triangular kickers.
      for (const sl of PIN.slings) {
        const mx = (sl.ax + sl.bx) / 2;
        const my = (sl.ay + sl.by) / 2;
        let ox = PIN.W / 2 - mx;
        let oy = PIN.H * 0.62 - my;
        const ol = Math.hypot(ox, oy) || 1;
        ox = (ox / ol) * 16;
        oy = (oy / ol) * 16;
        const vx = mx + ox;
        const vy = my + oy;
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.beginPath();
        c.moveTo(sl.ax, sl.ay + 3);
        c.lineTo(sl.bx, sl.by + 3);
        c.lineTo(vx, vy + 3);
        c.closePath();
        c.fill();
        const sg = c.createLinearGradient(sl.ax, sl.ay, vx, vy);
        sg.addColorStop(0, "#e14b4b");
        sg.addColorStop(1, "#ad3030");
        c.fillStyle = sg;
        c.beginPath();
        c.moveTo(sl.ax, sl.ay);
        c.lineTo(sl.bx, sl.by);
        c.lineTo(vx, vy);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(255,255,255,0.4)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(sl.ax, sl.ay);
        c.lineTo(vx, vy);
        c.lineTo(sl.bx, sl.by);
        c.stroke();
      }

      // One-way lane gate (sloped down-left, meeting the lane wall).
      neon("#c9d6e4", 6);
      c.lineWidth = 2.5;
      c.setLineDash([7, 5]);
      c.beginPath();
      c.moveTo(350, 250);
      c.lineTo(400, 238);
      c.stroke();
      c.setLineDash([]);
      // Chevrons indicating up-only flow.
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(370, 252);
      c.lineTo(375, 247);
      c.lineTo(380, 252);
      c.stroke();

      // Drain glow.
      c.shadowBlur = 0;
      c.strokeStyle = "rgba(248,113,113,0.5)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(175, PIN.H - 10);
      c.lineTo(245, PIN.H - 10);
      c.stroke();

      // Bumper triangles — extruded, rounded corners, silver trim + corner studs.
      const triCols = ["#2dd4bf", "#f5b83d", "#8b5cf6"];
      c.lineJoin = "round";
      const triFlash = s.triangleFlashAt ?? [0, 0, 0];
      for (let i = 0; i < PIN.triangles.length; i++) {
        const t = PIN.triangles[i];
        const col = triCols[i % triCols.length];
        const flash = now - triFlash[i] < 130;
        const dark = mix(col, -0.62);
        const face = flash ? mix(col, 0.55) : mix(col, 0.12);
        const gx = (t.a.x + t.b.x + t.c.x) / 3;
        const gy = (t.a.y + t.b.y + t.c.y) / 3;
        const inset = (v: { x: number; y: number }, d: number) => {
          const dx = gx - v.x;
          const dy = gy - v.y;
          const l = Math.hypot(dx, dy) || 1;
          return { x: v.x + (dx / l) * d, y: v.y + (dy / l) * d };
        };
        const a = inset(t.a, 4);
        const b = inset(t.b, 4);
        const q = inset(t.c, 4);
        // Extruded dark side face (the 3D block depth).
        c.fillStyle = dark;
        c.beginPath();
        c.moveTo(t.a.x, t.a.y + 5);
        c.lineTo(t.b.x, t.b.y + 5);
        c.lineTo(t.c.x, t.c.y + 5);
        c.closePath();
        c.fill();
        // Rounded top face (fill + thick round stroke).
        const tg = c.createLinearGradient(t.a.x, t.a.y, t.b.x, t.b.y);
        tg.addColorStop(0, mix(col, 0.3));
        tg.addColorStop(1, face);
        c.fillStyle = tg;
        c.strokeStyle = tg;
        c.lineWidth = 8;
        c.shadowColor = flash ? col : "transparent";
        c.shadowBlur = flash ? 24 : 0;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.lineTo(q.x, q.y);
        c.closePath();
        c.fill();
        c.stroke();
        c.shadowBlur = 0;
        // Silver trim line.
        c.strokeStyle = "rgba(230,236,244,0.85)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.lineTo(q.x, q.y);
        c.closePath();
        c.stroke();
        // Three silver corner studs.
        for (const v of [t.a, t.b, t.c]) {
          c.fillStyle = "#d7dde6";
          c.beginPath();
          c.arc(v.x, v.y, 3.4, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "rgba(255,255,255,0.85)";
          c.beginPath();
          c.arc(v.x - 1, v.y - 1, 1.3, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.lineJoin = "miter";

      // Top drop targets — raised colored blocks (green / red / purple).
      const blockCols = ["#39c07f", "#e14b4b", "#8b5cf6"];
      for (let i = 0; i < PIN.targets.length; i++) {
        const t = PIN.targets[i];
        const lit = s.targetLit[i];
        const flash = now - s.targetFlashAt[i] < 130;
        const col = blockCols[i % blockCols.length];
        const bw = 26;
        const bh = 18;
        const x0 = t.x - bw / 2;
        const y0 = t.y - bh / 2;
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.fillRect(x0 + 2, y0 + 3, bw, bh);
        c.fillStyle = mix(col, -0.28);
        c.fillRect(x0, y0 + 2, bw, bh);
        c.fillStyle = flash ? "#ffffff" : lit ? mix(col, 0.3) : col;
        c.fillRect(x0, y0, bw, bh);
        c.strokeStyle = "rgba(255,255,255,0.35)";
        c.lineWidth = 1;
        c.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, bh - 1);
      }

      // Pop bumpers — red center, orange sides, white rings.
      for (let i = 0; i < PIN.bumpers.length; i++) {
        const bu = PIN.bumpers[i];
        const flash = now - s.bumperFlashAt[i] < 140;
        const isCenter = i === 1;
        const capCol = isCenter ? "#e14b4b" : "#f08a3c";
        const baseCol = isCenter ? "#8b2e2e" : "#b5671f";
        c.fillStyle = baseCol;
        c.beginPath();
        c.arc(bu.x, bu.y, bu.r + 6, 0, Math.PI * 2);
        c.fill();
        const cap = c.createRadialGradient(bu.x - 4, bu.y - 5, 2, bu.x, bu.y, bu.r);
        cap.addColorStop(0, flash ? "#ffffff" : capCol);
        cap.addColorStop(1, flash ? "#ffd9c2" : baseCol);
        c.fillStyle = cap;
        c.shadowColor = capCol;
        c.shadowBlur = flash ? 26 : 12;
        c.beginPath();
        c.arc(bu.x, bu.y, bu.r, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = "#f5f7fa";
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(bu.x, bu.y, bu.r - 2, 0, Math.PI * 2);
        c.stroke();
      }

      // Jackpot flash.
      if (now - s.jackpotFlashAt < 400) {
        c.fillStyle = "rgba(52,211,153,0.12)";
        c.fillRect(0, 0, PIN.W, PIN.H);
      }

      // Flippers — gray teardrop bats.
      for (const f of s.flippers) {
        const cfg = f.isLeft ? PIN.flippers.left : PIN.flippers.right;
        const tx = cfg.pivotX + cfg.len * Math.cos(f.angle);
        const ty = cfg.pivotY + cfg.len * Math.sin(f.angle);
        const nx = Math.cos(f.angle + Math.PI / 2);
        const ny = Math.sin(f.angle + Math.PI / 2);
        const wBase = 13;
        const wTip = 7;
        const grad = c.createLinearGradient(cfg.pivotX, cfg.pivotY, tx, ty);
        grad.addColorStop(0, "#7d8792");
        grad.addColorStop(1, "#c9ced6");
        c.fillStyle = grad;
        c.shadowColor = "rgba(0,0,0,0.45)";
        c.shadowBlur = 6;
        c.beginPath();
        c.moveTo(cfg.pivotX + nx * wBase, cfg.pivotY + ny * wBase);
        c.lineTo(tx + nx * wTip, ty + ny * wTip);
        c.quadraticCurveTo(tx, ty, tx - nx * wTip, ty - ny * wTip);
        c.lineTo(cfg.pivotX - nx * wBase, cfg.pivotY - ny * wBase);
        c.quadraticCurveTo(cfg.pivotX, cfg.pivotY, cfg.pivotX + nx * wBase, cfg.pivotY + ny * wBase);
        c.closePath();
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = "rgba(255,255,255,0.5)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cfg.pivotX + nx * (wBase - 2), cfg.pivotY + ny * (wBase - 2));
        c.lineTo(tx + nx * (wTip - 1), ty + ny * (wTip - 1));
        c.stroke();
        c.fillStyle = "#5b626c";
        c.beginPath();
        c.arc(cfg.pivotX, cfg.pivotY, 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.beginPath();
        c.arc(cfg.pivotX - 1, cfg.pivotY - 1, 2.5, 0, Math.PI * 2);
        c.fill();
      }

      // Ball: motion streak + 3D sphere with rolling marker.
      const b = s.ball;
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 220 && !s.resting) {
        const k = Math.min(0.05, speed / 40000);
        const tailX = b.x - b.vx * k;
        const tailY = b.y - b.vy * k;
        const streak = c.createLinearGradient(b.x, b.y, tailX, tailY);
        streak.addColorStop(0, "rgba(255,255,255,0.5)");
        streak.addColorStop(1, "rgba(255,255,255,0)");
        c.strokeStyle = streak;
        c.lineWidth = R * 1.6;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(b.x, b.y);
        c.lineTo(tailX, tailY);
        c.stroke();
        c.lineCap = "butt";
      }
      const ballGrad = c.createRadialGradient(b.x - R * 0.4, b.y - R * 0.45, R * 0.1, b.x, b.y, R);
      ballGrad.addColorStop(0, "#ffffff");
      ballGrad.addColorStop(0.4, "#d8dee7");
      ballGrad.addColorStop(1, "#6b7380");
      c.fillStyle = ballGrad;
      c.shadowColor = "rgba(0,0,0,0.55)";
      c.shadowBlur = 5;
      c.beginPath();
      c.arc(b.x, b.y, R, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(b.x - R * 0.35, b.y - R * 0.42, R * 0.24, 0, Math.PI * 2);
      c.fill();
      const mk = R * 0.55;
      c.fillStyle = "rgba(15,20,30,0.55)";
      c.beginPath();
      c.arc(b.x + Math.cos(b.rot) * mk, b.y + Math.sin(b.rot) * mk, 1.4, 0, Math.PI * 2);
      c.fill();

      // Plunger spring when resting.
      if (s.resting) {
        c.strokeStyle = "#c9ced6";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(375, 715);
        for (let i = 0; i < 5; i++) {
          c.lineTo(i % 2 ? 370 : 380, 707 - i * 5);
        }
        c.stroke();
      }

      // Drain flash.
      if (now - s.drainAt < 250) {
        c.fillStyle = "rgba(248,113,113,0.12)";
        c.fillRect(0, 0, PIN.W, PIN.H);
      }

      // Floating score popups.
      for (let i = s.popups.length - 1; i >= 0; i--) {
        const p = s.popups[i];
        const age = now - p.born;
        if (age > 900) {
          s.popups.splice(i, 1);
          continue;
        }
        const t = age / 900;
        c.globalAlpha = 1 - t;
        c.fillStyle = "#a9d4f0";
        c.font = "bold 14px ui-monospace, SFMono-Regular, monospace";
        c.textAlign = "center";
        c.fillText(p.text, p.x, p.y - t * 28);
        c.globalAlpha = 1;
      }

      if (shakeScale > 0.3) c.restore();
      s.shakeAmt *= 0.88;

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [addScore, loseBall, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard + pointer.
  useEffect(() => {
    function press(f: FlipperState, down: boolean) {
      if (f.pressed !== down) {
        f.pressed = down;
        if (down) beep(actxRef.current, 200, "square", 0.04, 0.06);
      }
    }
    function down(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        if (!actxRef.current) actxRef.current = new AudioContext();
        const s = simRef.current;
        if (s.phase === "over") restart();
        else if (s.phase === "ready") startGame();
        else if (s.resting && !s.charging) {
          s.charging = true;
        }
        return;
      }
      if (e.code === "KeyR" && simRef.current.phase === "over") {
        restart();
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        press(simRef.current.flippers[0], true);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        press(simRef.current.flippers[1], true);
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") {
        const s = simRef.current;
        if (s.resting && s.charging) launch();
        s.charging = false;
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        press(simRef.current.flippers[0], false);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        press(simRef.current.flippers[1], false);
      }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [launch, restart, startGame]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!actxRef.current) actxRef.current = new AudioContext();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PIN.W;
    const s = simRef.current;
    if (s.phase === "ready") {
      startGame();
      return;
    }
    if (s.phase !== "playing") return;
    if (x < PIN.W / 2) {
      if (!s.flippers[0].pressed) {
        s.flippers[0].pressed = true;
        beep(actxRef.current, 200, "square", 0.04, 0.06);
      }
    } else if (!s.flippers[1].pressed) {
      s.flippers[1].pressed = true;
      beep(actxRef.current, 200, "square", 0.04, 0.06);
    }
  }

  function onPointerUp() {
    const s = simRef.current;
    s.flippers[0].pressed = false;
    s.flippers[1].pressed = false;
  }

  // Mobile / touch control helpers.
  function touchFlipper(idx: 0 | 1, down: boolean) {
    const s = simRef.current;
    if (down) {
      if (!actxRef.current) actxRef.current = new AudioContext();
      if (s.phase === "ready") {
        startGame();
        return;
      }
      if (s.phase !== "playing") return;
      if (!s.flippers[idx].pressed) beep(actxRef.current, 200, "square", 0.04, 0.06);
    }
    s.flippers[idx].pressed = down;
  }

  function chargerDown() {
    const s = simRef.current;
    if (!actxRef.current) actxRef.current = new AudioContext();
    if (s.phase === "ready") {
      startGame();
      return;
    }
    if (s.phase === "over") {
      restart();
      return;
    }
    if (s.phase === "playing" && s.resting && !s.charging) {
      s.charging = true;
    }
  }

  function chargerUp() {
    const s = simRef.current;
    if (s.resting && s.charging) launch();
    s.charging = false;
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3">
      <div className="flex w-full max-w-[420px] items-center justify-between text-sm">
        <p className="text-zinc-400">
          Score: <span className="font-display text-lg text-zinc-100">{score}</span>
        </p>
        <p className="text-zinc-500">
          Ball{" "}
          <span className="font-display text-zinc-200">
            {Math.min(ballIdx, MAX_BALLS)}/{MAX_BALLS}
          </span>
          <span className="ml-2">Best: <span className="font-display text-zinc-200">{best}</span></span>
        </p>
      </div>

      <div
        ref={boardRef}
        className="relative flex w-full max-w-[420px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 shadow-xl shadow-violet-950/40"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="block cursor-pointer"
          style={{
            width: board.w,
            height: board.h,
            maxWidth: "100%",
            touchAction: "none",
          }}
        />
        {/* Plunger power bar */}
        {simRef.current.resting && phase === "playing" && (
          <div className="pointer-events-none absolute bottom-14 right-6 flex flex-col items-end gap-1">
            <p className="text-[10px] uppercase tracking-widest text-violet-300">
              Plunger
            </p>
            <div className="relative h-32 w-3 rounded-full border border-violet-500/40 bg-zinc-900">
              <div
                className="absolute bottom-0 w-3 rounded-full bg-violet-400 transition-none"
                style={{ height: `${power * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-500">
              {simRef.current.charging ? "release!" : "hold SPACE"}
            </p>
          </div>
        )}
        {phase === "ready" && (
          <button
            onClick={() => {
              if (!actxRef.current) actxRef.current = new AudioContext();
              startGame();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 text-center"
          >
            <span className="text-3xl">🎱</span>
            <span className="font-display text-xl tracking-wide">Neon Pinball</span>
            <span className="text-sm text-zinc-400">
              ← / A — left flipper · → / D — right flipper
              <br />
              Hold SPACE (or the ⬆ Launch button) to charge, release to launch
            </span>
            <span className="arcade-chip mt-2">Insert coin · Play</span>
          </button>
        )}
        {phase === "over" && (
          <button
            onClick={restart}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/85 text-center"
          >
            <span className="text-3xl">💀</span>
            <span className="font-display text-xl tracking-wide">Game over</span>
            <span className="text-sm text-zinc-300">
              Score{" "}
              <span className="font-mono text-lg">{simRef.current.finalScore}</span>
              {simRef.current.finalScore >= best && best > 0
                ? " — new best!"
                : ""}
            </span>
            <span className="arcade-chip mt-2">Play again</span>
          </button>
        )}
      </div>

      {/* Mobile / touch controls — visible on small screens, hidden on desktop. */}
      <div className="flex w-full max-w-[420px] shrink-0 items-stretch gap-2 sm:hidden">
        <button
          onPointerDown={() => touchFlipper(0, true)}
          onPointerUp={() => touchFlipper(0, false)}
          onPointerLeave={() => touchFlipper(0, false)}
          className="flex-1 select-none rounded-2xl border border-violet-500/30 bg-violet-500/10 py-4 text-sm font-bold text-violet-200 active:bg-violet-500/30"
          style={{ touchAction: "none" }}
        >
          ◀ Left
        </button>
        <button
          onPointerDown={chargerDown}
          onPointerUp={chargerUp}
          onPointerLeave={chargerUp}
          className="flex-1 select-none rounded-2xl border border-violet-400/40 bg-violet-500/20 py-4 text-sm font-bold text-violet-100 active:bg-violet-500/45"
          style={{ touchAction: "none" }}
        >
          ⬆ Launch
        </button>
        <button
          onPointerDown={() => touchFlipper(1, true)}
          onPointerUp={() => touchFlipper(1, false)}
          onPointerLeave={() => touchFlipper(1, false)}
          className="flex-1 select-none rounded-2xl border border-violet-500/30 bg-violet-500/10 py-4 text-sm font-bold text-violet-200 active:bg-violet-500/30"
          style={{ touchAction: "none" }}
        >
          Right ▶
        </button>
      </div>

      <p className="shrink-0 text-center text-xs text-zinc-600">
        Free practice · one identical table for everyone · paid rounds 0.10
        USDC coming soon
      </p>
    </div>
  );
}
