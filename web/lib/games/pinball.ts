/**
 * Neon Pinball table geometry.
 *
 * The table is completely static — every player faces the identical machine,
 * which is what keeps tournaments fair. Physics + launcher power + flipper
 * timing are the only inputs.
 */

export const PIN = {
  W: 420,
  H: 740,
  ballR: 8,

  /** Bouncy playfield walls (segments). */
  walls: [
    { ax: 20, ay: 40, bx: 20, by: 730, e: 0.5 }, // left
    { ax: 400, ay: 40, bx: 400, by: 740, e: 0.5 }, // right
    { ax: 20, ay: 40, bx: 70, by: 20, e: 0.5 }, // top-left
    { ax: 70, ay: 20, bx: 350, by: 20, e: 0.5 }, // top
    { ax: 350, ay: 20, bx: 400, by: 40, e: 0.5 }, // top-right
    { ax: 20, ay: 760, bx: 175, by: 732, e: 0.4 }, // bottom-left shelf, steep slope to the drain
    { ax: 350, ay: 760, bx: 245, by: 732, e: 0.4 }, // bottom-right shelf, steep slope to the drain (meets the lane wall)
    { ax: 350, ay: 270, bx: 350, by: 730, e: 0.5 }, // plunger lane wall (starts below the one-way gate)
    { ax: 350, ay: 730, bx: 400, by: 730, e: 0.4 }, // lane floor
  ],

  /** Slingshot kickers above the flippers — high restitution + score. */
  slings: [
    { ax: 92, ay: 596, bx: 154, by: 638, e: 0.95 },
    { ax: 328, ay: 596, bx: 266, by: 638, e: 0.95 },
  ],

  /**
   * Pop bumpers — radial impulse on hit.
   * Centered on x=185 (midpoint of the left wall x=20 and the ball-tunnel wall x=350).
   */
  bumpers: [
    { x: 95, y: 320, r: 17 },
    { x: 185, y: 250, r: 17 },
    { x: 275, y: 320, r: 17 },
  ],

  /**
   * Drop targets — light all six for a jackpot.
   * Two groups symmetric about x=185, equidistant from the two side borders.
   */
  targets: [
    { x: 305, y: 150, r: 9 },
    { x: 275, y: 115, r: 9 },
    { x: 305, y: 80, r: 9 },
    { x: 65, y: 150, r: 9 },
    { x: 95, y: 115, r: 9 },
    { x: 65, y: 80, r: 9 },
  ],

  /**
   * Bumper-sized triangles.
   * Left + right have their edge (base) flush against the side border, with only
   * the point jutting out into the field. Center points up and is enlarged.
   */
  triangles: [
    { a: { x: 20, y: 453 }, b: { x: 20, y: 479 }, c: { x: 42, y: 466 } },
    { a: { x: 185, y: 442 }, b: { x: 207, y: 480 }, c: { x: 163, y: 480 } },
    { a: { x: 350, y: 453 }, b: { x: 350, y: 479 }, c: { x: 328, y: 466 } },
  ],

  flippers: {
    left: { pivotX: 170, pivotY: 650, len: 55, rest: -0.611, pressed: -1.833 },
    right: {
      pivotX: 250,
      pivotY: 650,
      len: 55,
      rest: Math.PI + 0.611,
      pressed: Math.PI + 1.833,
    },
  },

  lane: { x: 375, restY: 690, topY: 250 },
  drainY: 742,
} as const;

export const PIN_SCORE = {
  bumper: 100,
  target: 50,
  jackpot: 500,
  sling: 25,
  triangle: 150,
} as const;
