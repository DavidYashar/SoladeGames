"use client";

import { useEffect, useRef } from "react";

/**
 * Full-viewport canvas of drifting gold/neon particles (behind content).
 * Respects prefers-reduced-motion: renders a single static frame, no loop.
 */
export function ParticleBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const COLORS = ["#f7c948", "#22d3ee", "#a78bfa", "#f472b6", "#34d399"];
    interface P {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      c: string;
      a: number;
      tw: number;
    }
    let parts: P[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      const count = Math.min(90, Math.max(40, Math.floor((w * h) / 22000)));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: Math.random() * 2.2 + 0.6,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        a: Math.random() * 0.45 + 0.15,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const drawParticle = (p: P) => {
      const alpha = p.a * (0.65 + 0.35 * Math.sin(p.tw));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.c;
      ctx.shadowColor = p.c;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.01;
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        if (p.y < -4) p.y = h + 4;
        if (p.y > h + 4) p.y = -4;
        drawParticle(p);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };

    const drawOnce = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) drawParticle(p);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const onResize = () => {
      resize();
      init();
      if (prefersReduced) drawOnce();
      else loop();
    };

    resize();
    init();
    if (prefersReduced) {
      drawOnce();
    } else {
      loop();
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 opacity-50"
    />
  );
}
