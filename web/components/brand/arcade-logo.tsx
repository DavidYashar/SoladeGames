import type { CSSProperties } from "react";

/* ------------------------------------------------------------------ *
 * SolAde Games brand marks.
 *
 * Both pieces are pure inline SVG with no background fill, so they sit
 * transparently on black chrome, on the steel-blue machines, or on
 * paper. Whites use `currentColor`; the eyes stay cyan.
 *
 * Pixel grid: 7 wide x 9 tall per glyph, drawn with integer rects and
 * `shapeRendering="crispEdges"` so the strokes never anti-alias into
 * mush at small sizes.
 * ------------------------------------------------------------------ */

const GLYPHS: Record<string, readonly string[]> = {
  // "A" of ARC — the counter reads as a plus, like the wordmark.
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
  S: [
    "0111111",
    "1111111",
    "1100000",
    "1100000",
    "0111110",
    "0000011",
    "0000011",
    "1111111",
    "0111111",
  ],
  O: [
    "0011100",
    "0111110",
    "1110111",
    "1100011",
    "1100011",
    "1100011",
    "1110111",
    "0111110",
    "0011100",
  ],
  L: [
    "1100000",
    "1100000",
    "1100000",
    "1100000",
    "1100000",
    "1100000",
    "1100000",
    "1111111",
    "1111111",
  ],
};

/** Merge filled cells in a row into horizontal runs → fewer rects. */
function rowRuns(row: string): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
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
}

function glyphRects(letter: string, dx: number, dy: number) {
  const bitmap = GLYPHS[letter];
  if (!bitmap) return null;
  return bitmap.flatMap((row, y) =>
    rowRuns(row).map(([x0, x1], i) => (
      <rect
        key={`${letter}-${y}-${i}`}
        x={dx + x0}
        y={dy + y}
        width={x1 - x0}
        height={1}
        fill="currentColor"
      />
    )),
  );
}

/* ------------------------------------------------------------------ */

export type RobotMarkProps = {
  className?: string;
  /** Decorative by default; pass a title to expose it to screen readers. */
  title?: string;
  /** Eye colour — defaults to the brand cyan. */
  eyeColor?: string;
};

/**
 * The robot-A: a white pentagon head, an antenna, a dark face plate and
 * two cyan eyes. Portrait aspect (7:9).
 */
export function RobotMark({
  className,
  title,
  eyeColor = "var(--arcade-cyan)",
}: RobotMarkProps) {
  return (
    <svg
      viewBox="0 0 7 9"
      className={className}
      shapeRendering="crispEdges"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ ["--robot-eye" as string]: eyeColor } as CSSProperties}
    >
      {title ? <title>{title}</title> : null}
      {/* antenna */}
      <rect x="3.2" y="0" width="0.6" height="1.3" fill="currentColor" />
      {/* head */}
      <path d="M3.5 1.15 L6.6 2.75 V8.85 H0.4 V2.75 Z" fill="currentColor" />
      {/* face plate */}
      <rect x="1.2" y="3.7" width="4.6" height="3.8" fill="var(--arcade-ink)" />
      {/* eyes */}
      <rect
        x="1.95"
        y="4.7"
        width="1.05"
        height="1.5"
        fill="var(--robot-eye)"
      />
      <rect
        x="4"
        y="4.7"
        width="1.05"
        height="1.5"
        fill="var(--robot-eye)"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

const WORDMARK_UNITS = 52;

/**
 * "SOLADE" wordmark. A real A, not the robot: at header size the robot's pentagon
 * reads as a blob, and the word has to be legible first. The robot survives as its
 * own mark (RobotMark) wherever there is room for a face.
 */
export function SoladeWordmark({
  className,
  title = "SOLADE",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 52 9"
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {glyphRects("S", 0, 0)}
      {glyphRects("O", 9, 0)}
      {glyphRects("L", 18, 0)}
      {glyphRects("A", 27, 0)}
      {glyphRects("D", 36, 0)}
      {glyphRects("E", 45, 0)}
    </svg>
  );
}
