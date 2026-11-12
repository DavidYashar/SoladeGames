# Neon Pinball: current state

Last updated 2026-11-12. This describes the cabinet **as it exists in code today**.

---

## 1. The cabinet

A real-scale pinball table in the same dark room as the other cabinets.

| Element | Value |
|---|---|
| Playfield | 0.54 m x 1.08 m, bed at 0.85 m |
| Camera | `(1.18, 2.26, 0)`, looking at `(0, 0.87, 0)`, **50°** to the bed, fov 40 |
| Shooter lane | 55 mm nominal, clear width 39 mm, centre `z = -0.2385` |
| Ball | radius 0.0135 m, Blender sphere |
| Slope | the table is rendered flat, so a constant **+1.5 m/s²** pull on X stands in for the slope |

The camera is fixed by design; it matches the billiard cabinet's angle.

---

## 2. Controls

| Key | Action |
|---|---|
| **Space** (hold) | draws the plunger spring; release to fire |
| **← / A** | left flipper |
| **→ / D** | right flipper |

Plunge speed is `1.6 + charge * 3.8` m/s, with charge filling over 1.1 s.

---

## 3. The furniture

| Object | Behaviour | Points |
|---|---|---|
| **Bell ×5** | kicks the ball away, flashes white, builds the chain | 30 / 20 / 10 / 10 / 20 |
| **Slingshot ×2** | red triangle flush on each rail, restitution 1.15 | 25 |
| **Drop targets ×6** | diamond of plates in the middle | 50 each |
| **Rollover rings** | 12 + 8 posts | 10 each |
| **Saucer** | sensor behind the top arch | 250 |
| **Spinners ×2** | visual only for now | — |

Bells are domed spheres in physics (nothing can rest on them), with a canvas face
showing their value and a coloured sunburst.

### The chain

Every bell hit adds one to the chain, up to ×7, and every scoring hit is multiplied by
it. The chain decays to ×1 after 2.6 s without a hit. Shown in the HUD.

---

## 4. The flipper assembly

Modelled in Blender to the reference drawing:

- black bent arm with a **silver border**, four cross-head screws along the diagonal
- white-framed **hinge** at the pivot
- red **capsule flipper** with a cream border and a central screw
- each arm's leg reaches its rail: the left on the field wall, the right on the corridor wall

Both origins sit on the pivot, so arm and flipper share one anchor. The flippers swing
**exactly 30°** at 16 rad/s and return.

---

## 5. Assets: Blender pipeline

```
art/build_pinball_parts.py       bumper, ball, post, target, slingshot
art/build_flipper_assembly.py    flipper, lane_arm, lane_arm_right
```

Run with:

```
blender -b --python art/build_pinball_parts.py
blender -b --python art/build_flipper_assembly.py
```

**Build order matters.** Both write into `web/public/models/pinball/`, and the assembly
script owns `flipper.glb`. Running the parts script last overwrites the flipper with the
old model, which is how the flippers once turned white.

Art is visual only. **Colliders are created in code from the same constants**, so the
art can improve without the physics drifting.

---

## 6. Measured behaviour

| Check | Result |
|---|---|
| Plunger | 0.65 charge gives 3.2 m/s; full charge crosses the lane in ~120 ms |
| Lane exit | ball leaves the lane and enters the field (`z` −0.24 → −0.08 → +0.24) |
| Flipper swing | 0.785 → 1.309 rad = **30.0°** each side |
| Bell kick | ball dropped on a bell centre is thrown 88 mm clear in 300 ms |
| Drain | one drain in a nine-second run with the funnels in place |

---

## 7. Known issues

1. **Arm colliders are straight.** The funnels under the bent arms are two boxes, so a
   ball rolling the wall can cut the corner inside the visible black arm.
2. **Spinners do not react.** They turn on a timer, not on contact.
3. **Drop targets never reset**, and clearing the bank does nothing.
4. **The saucer pays but does not hold** the ball.
5. **No sound.**
6. **Chain tuning is guesswork**: 2.6 s decay may be too short or too long.
7. **Debug hooks** (`__pin`, `__place`, `__kick`, `__flip`, `__near`, `__at`, `__ghost`)
   ship in the bundle.

---

## 8. What remains

1. **Colliders that follow the arms** — a polyline of cuboids matching the visual path.
2. **Spinner behaviour**: pay per rotation, on contact.
3. **Drop target bank**: light up when cleared, reset after a delay.
4. **Saucer**: hold briefly, then fire the ball back out.
5. **Sound**: bell hits, flipper, plunge, drain.
6. **Playfield art**: inserts, lane guides, decals — the biggest visual step left.

---

## 9. Where this sits in the arcade

| Cabinet | State |
|---|---|
| **Stack Tower** | playable, 3D, deterministic opponent |
| **Brick Blitz** | playable, 3D, on a billiard table |
| **Neon Pinball** | playable, 3D, Blender furniture |
| Bubble Pop | dropped |

Three of four, with pinball now at the same stage the other two reached: playable, with
the object behaviour still to deepen.
