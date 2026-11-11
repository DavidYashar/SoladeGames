"use client";

import { useEffect, useRef } from "react";

// Brand cyan, kept faint so the hall stays a backdrop and never competes
// with the cabinets. Chrome palette: black field + cyan grid.
const CYAN = "34, 224, 255";

/**
 * Infinite perspective grid tunnel. Cyan lines on a near-black hall, converging
 * to a dark vanishing point in the center. Animated (reduced-motion = static).
 * Purely decorative — fixed behind all content.
 */
export function GridTunnel() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawGrid = (phase: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const ROWS = 18;
      const RADIAL = 16;

      // Longitudinal (radial) lines — fan from the vanishing point to top/bottom edges.
      ctx.lineWidth = 1;
      for (let i = -RADIAL; i <= RADIAL; i++) {
        const x = cx + (i / RADIAL) * w * 0.5;
        ctx.strokeStyle = `rgba(${CYAN}, 0.18)`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, h);
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, 0);
        ctx.stroke();
      }

      // Transverse lines on floor + ceiling, scrolling outward (infinite motion).
      for (const dir of [1, -1]) {
        const spread = dir === 1 ? h - cy : cy;
        for (let j = 0; j < ROWS; j++) {
          const d = ((j / ROWS) + phase) % 1;
          const y = cy + dir * spread * Math.pow(d, 2.2);
          const alpha = 0.05 + 0.3 * Math.pow(d, 1.6);
          ctx.strokeStyle = `rgba(${CYAN}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }

      // Dark horizon band at the vanishing point (center).
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const band = 150;
      g.addColorStop(Math.max(0, (cy - band) / h), "rgba(3,5,10,0)");
      g.addColorStop(cy / h, "rgba(3,5,10,0.98)");
      g.addColorStop(Math.min(1, (cy + band) / h), "rgba(3,5,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    let phase = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      phase = (phase + dt * 0.22) % 1;
      drawGrid(phase);
      raf = requestAnimationFrame(loop);
    };

    const onResize = () => {
      resize();
      drawGrid(prefersReduced ? 0.3 : phase);
    };

    resize();
    if (prefersReduced) {
      drawGrid(0.3);
    } else {
      loop(performance.now());
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
      className="pointer-events-none fixed inset-0 -z-10 opacity-80"
    />
  );
}
