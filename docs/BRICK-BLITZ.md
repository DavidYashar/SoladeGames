# Brick Blitz: current state

Last updated 2026-11-13. This describes the game **as it exists in code today**: a
brick-breaker played on a billiard table.

`docs/archive/GAME-RULES.md` describes the earlier canvas version and is superseded.

---

## 1. The cabinet

Not a neon arcade wall. A real 8-foot table in a dark room, seen from the short end at
50 degrees, with the ball, a gilt handler and a wall of bricks where the rack would be.

| Element | Value |
|---|---|
| Playing bed | 2.24 m x 1.58 m, 0.78 m off the floor, widened from a true 1.12 m |
| Camera | `(2.96, 4.3, 0)`, looking at `(0, 0.80, 0)`, 50 degrees to the bed, fov 42 |
| Cloth | green `#1f6b45`, roughness 0.95 |
| Ball | radius 0.042 m, 96 x 64 segments, blue with a procedural skin |
| Ball shadow | painted contact shadow, 2.4 radii, offset toward the player |
| Handler | gilt bar, 0.46 m long, follows the pointer across the table |

The camera is fixed by design. Do not move it without being asked.

---

## 2. The wall

Eight columns across the table, five rows deep at the start, one brick every 0.095 m.

| Type | Hits | Points | Bounce (restitution) | Boost | Burst |
|---|---|---|---|---|---|
| **Clay** | 1 | 10 | 0.30 | x1.12 | dull chunks, heavy gravity |
| **Glass** | 1 | 15 | 0.96 | x1.24 | 20 bright shards, fast |
| **Stone** | 2 | 25 | 0.45 | x1.15 | grey blocks |
| **Keg** | 1 | 40 | 0.40 | x1.15 | embers, emissive |
| **Gold** | 1 | 50 | 0.62 | x1.18 | warm metallic flecks |
| **Iron** | 3 | 60 | 0.94 | x1.30 | white-hot sparks, longest |

Spawn weights are 52 / 20 / 10 / 8 / 6 / 4, applied through **exact quotas** rather
than weighted chance. Weighted chance let glass vanish from a 40-brick wall entirely,
which is unacceptable for a wall you are meant to read.

Each material carries three procedural maps (colour, roughness, bump) generated on a
canvas at runtime. Metals also need the room probe, or they render nearly black.

---

## 3. Rules

| Event | Result |
|---|---|
| Ball hits a brick | one hit point lost; cracks appear |
| Hit points reach zero | brick vanishes in its material burst, score awarded |
| Burst | visual only, never damages neighbours |
| Brick destroyed | its collider is removed, so the ball flies through the gap |
| Every 10 s | a new row appears at the far end and the wall shifts one row closer |
| Wall cleared | **win** |
| Any brick crosses the halfway line | **lose** |

The halfway line is drawn on the cloth at `x = 0`. With rows at 0.095 m each, the
eleventh row is the one that crosses it.

---

## 4. Ball physics

Rapier, fixed 1/120 step, CCD on, `normalizedPredictionDistance` 0.0005.

| Setting | Value |
|---|---|
| Serve speed | 3.8 m/s |
| Speed floor | 3.0 m/s, enforced every frame |
| Speed ceiling | 7.0 m/s |
| Linear / angular damping | 0.06 / 0.15 |

Two things were learned the hard way:

1. **Restitution only removes energy.** Without a boost the ball dies mid-table after
   a few clay bricks. Every surface it strikes multiplies the *incoming* speed, with a
   floor so a dead ball cannot stall and an auto re-serve if it stops entirely.
2. **Boost the incoming speed, not the outgoing one.** Boosting what restitution left
   behind made every material feel identical, because the floor snapped them all to the
   same number.

Contact geometry matters too. The side colliders originally sat 20 mm inside the
visible cushions, and Rapier predicts contacts up to 20 mm early by default; both are
fixed, and a slow ball now stops at exactly the painted face.

---

## 5. Architecture

```
web/components/games/pool-table.tsx   table, wall, ball, handler, bursts, HUD, rules
web/lib/jenga/brick-skins.ts          the six procedural surface sets
web/lib/jenga/ball-skin.ts            ball skin and contact shadow
web/lib/jenga/wood.ts                 rail timber
```

`Physics` owns the Rapier world and diffs the rendered wall against it: colliders are
created for new bricks, removed for destroyed ones, and rebuilt when a row shifts.
Hits are reported upward with a callback, so game state lives in one place.

---

## 5b. How a brick hit is detected

Not by Rapier's contact events. Those are reliable for a square hit and unreliable for a
graze: a ball clipping a side or corner often separates before the event is delivered, so
the ball bounced, nothing scored and no sound played.

Instead the ball's path between frames is **swept** against each brick's footprint:

- the segment from last frame's position to this one is sampled every 15 mm, so nothing
  is skipped at 7 m/s (~120 mm per frame)
- distance is measured to the brick's rectangle, not its centre, so **side and corner
  contacts count**
- a contact is **latched**: one touch is one hit point, and the brick cannot be hit again
  until the ball is 19 mm clear of it

That last rule matters. An earlier version used a 140 ms cooldown, which let a ball that
lingered against iron drain all three of its hit points from a single contact — accurate
but far too easy.

Verified serve by serve: hit points consumed always equal hits registered.

## 5c. Sound

Six recorded material hits in `web/public/audio/bricks/` — clay, stone, glass, keg, gold,
iron — plus a cue strike, rail thumps, a row warning and end-of-round cues.

Three things make it work:

1. **Play from the transient, not the file start.** The recordings do not begin with the
   hit: iron's lands 0.9 s into a 15 s file. Each sample is measured on load, the rise out
   of the noise floor found, and playback starts there for a 0.5 s window.
2. **Level each recording.** RMS is measured over the first 0.3 s from that onset and a
   per-sample gain (0.7–2.6x) evens out a 5:1 spread between recordings.
3. **No blanket rate limit.** Throttling all bricks to one sound per 22 ms dropped real
   hits when the ball crossed several bricks in a frame. Only a ceiling of 6 starts per
   30 ms remains, to stop a burst swamping the mix.

A rail thump is suppressed for 90 ms after a brick hit, or the generic thud buried the
material character.

There is **no continuous ambience or rolling bed** in this game — the earlier noise-based
roll read as wind and was removed.

## 6. Measured behaviour

| Check | Result |
|---|---|
| Ball speed over a 12 s rally | 3.0 to 7.0, mean ~4.9 m/s |
| Slow ball against the side cushion | stops at 0.7480 m, exact contact point |
| Row spawn | +8 bricks, wall shifts one row |
| Lose flow | verified by temporarily setting the interval to 1.2 s |
| Initial wall | 40 bricks, composition 21 / 9 / 4 / 3 / 2 / 1 |

---

## 7. Known issues

1. **The wall is dense.** Only the front face is reachable, so the back rows are dead
   weight until the front clears. Clearing may be near-impossible rather than hard.
2. **The handler can trap the ball** against a rail or between bricks.
3. **Rows spawn on a fixed 10 s clock** regardless of how the player is doing.
4. **No scoring for streaks**, no wave counter, no saved best.
5. **Debug surfaces remain** (`window.__ballState`, `__launch`, `__handlerZ`) and ship
   in the bundle.
6. **Glass reads as pale mint** at 25 px more than it reads as glass.
7. **Sound** does not exist.

---

## 8. What remains

1. **Difficulty curve**: spawn interval, wall density and ball speed should react to
   how well the player is doing.
2. **Reachability**: a shallower wall, or gaps that open sideways, so back rows can be
   attacked.
3. **Scoring depth**: streaks, rare-brick bonuses, and a saved best score.
4. **Trapping**: detect a stalled ball and re-serve sooner.
5. **Sound** for impacts and bursts, per material.
6. **The hall**: two cabinets are playable, Bubble Pop and Pinball are not yet rebuilt.

---

## 9. Where this sits in the arcade

| Cabinet | State |
|---|---|
| **Stack Tower** | playable, 3D, deterministic opponent |
| **Brick Blitz** | playable, 3D, survives on the table |
| Bubble Pop | not rebuilt |
| Pinball | not rebuilt |

Two of four. The remaining two come before any further polish on these.
