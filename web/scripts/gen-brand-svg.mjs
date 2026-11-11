/**
 * Generates the shareable, background-free brand SVGs in public/brand/.
 *
 * The glyph bitmaps here mirror components/brand/arcade-logo.tsx — if you
 * change the wordmark, change both (or delete this script and ship the
 * component only).
 *
 * Usage: node scripts/gen-brand-svg.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "brand");

const GLYPHS = {
  A: [
    "0011100",
    "0111110",
    "1110111",
    "1100011",
    "1110111",
    "1111111",
    "1100011",
    "1100011",
    "1100011",
  ],
  R: [
    "1111110",
    "1100011",
    "1100011",
    "1100011",
    "1111110",
    "1100110",
    "1100011",
    "1100011",
    "1100011",
  ],
  C: [
    "0111111",
    "1111111",
    "1100000",
    "1100000",
    "1100000",
    "1100000",
    "1100000",
    "1111111",
    "0111111",
  ],
  D: [
    "1111110",
    "1111111",
    "1100011",
    "1100011",
    "1100011",
    "1100011",
    "1100011",
    "1111111",
    "1111110",
  ],
  E: [
    "1111111",
    "1111111",
    "1100000",
    "1100000",
    "1111110",
    "1111110",
    "1100000",
    "1111111",
    "1111111",
  ],
};

const rowRuns = (row) => {
  const runs = [];
  let start = -1;
  for (let i = 0; i < row.length; i += 1) {
    const filled = row[i] === "1";
    if (filled && start < 0) start = i;
    if (!filled && start >= 0) {
      runs.push([start, i]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, row.length]);
  return runs;
};

const glyph = (letter, dx) =>
  GLYPHS[letter]
    .flatMap((row, y) =>
      rowRuns(row).map(([x0, x1]) => `<rect x="${dx + x0}" y="${y}" width="${x1 - x0}" height="1"/>`),
    )
    .join("");

const robot = (dx, { eyeFill = "#22e0ff", plate = "#050507" } = {}) => `
  <g transform="translate(${dx} 0)">
    <rect x="3.2" y="0" width="0.6" height="1.3"/>
    <path d="M3.5 1.15 L6.6 2.75 V8.85 H0.4 V2.75 Z"/>
    <rect x="1.2" y="3.7" width="4.6" height="3.8" fill="${plate}"/>
    <rect x="1.95" y="4.7" width="1.05" height="1.5" fill="${eyeFill}"/>
    <rect x="4" y="4.7" width="1.05" height="1.5" fill="${eyeFill}"/>
  </g>`;

mkdirSync(outDir, { recursive: true });

/* --- robot-A only (favicon / avatar / stamp) --- */
writeFileSync(
  join(outDir, "robot-a.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 9" width="140" height="180" shape-rendering="crispEdges" fill="#ffffff">
  <title>ARC_ADE robot-A</title>
${robot(0)}
</svg>
`,
  "utf8",
);

/* --- wordmark: ARC_ADE, transparent background --- */
writeFileSync(
  join(outDir, "arc-ade-wordmark.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 9" width="640" height="90" shape-rendering="crispEdges" fill="#ffffff">
  <title>ARC_ADE</title>
  <defs>
    <linearGradient id="arcade-bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22e0ff"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <g>
    ${glyph("A", 0)}
    ${glyph("R", 9)}
    ${glyph("C", 18)}
    <rect x="28" y="6.6" width="9" height="2.2" fill="url(#arcade-bar)"/>
    ${robot(39)}
    ${glyph("D", 48)}
    ${glyph("E", 57)}
  </g>
</svg>
`,
  "utf8",
);

/* --- wordmark for dark chrome (same art, black plate baked) --- */
console.log("wrote public/brand/robot-a.svg");
console.log("wrote public/brand/arc-ade-wordmark.svg");
