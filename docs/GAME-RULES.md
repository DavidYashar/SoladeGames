# Arkade game rules

The four cabinets, written down as rules rather than code.

This document is the source of truth for the 3D rebuild. The canvas implementations
are being replaced, so everything worth keeping has to live here: board generation,
scoring, combos, specials, end conditions and tunables. Numbers below are taken from
the code that shipped, not from memory or from the earlier README.

Where an item was ambiguous in the old implementation it is marked **confirm**, and
the rebuild must decide it explicitly rather than inherit an accident.

---

## 0. Rules shared by every cabinet

### 0.1 The daily seed

Every board derives from the UTC date, never from chance:

```ts
createDailyRng(dateKey, salt) = mulberry32(hashSeed(`${dateKey}:${salt}`))
```

| Game | Seed call | Salt |
|---|---|---|
| Stack Tower | `createDailyRng(dateKey, "stack-tower")` | `stack-tower` |
| Brick Blitz | `createDailyRng(dateKey + ":" + wave, "brick-blitz")` | `brick-blitz` |
| Bubble Pop | `createDailyRng(dateKey, "bubble-pop")` | `bubble-pop` |
| Neon Pinball | static table, no generation | none |

Consequence: two players on the same date face the identical machine, which is what
makes a score comparable across wallets. The accepted tradeoff is that a board can be
memorised.

### 0.2 Invariants for the rebuild

1. No `Math.random()` in simulation code. Randomness comes only from the seeded RNG.
2. Fixed timestep for every simulation. Frame rate must not change outcomes.
3. Input is sampled per tick, not per frame.
4. The rendered scene may be 3D; the simulation may not depend on it.
5. A run is reproducible from `(dateKey, gameId, input log)`.

### 0.3 Local records

Per cabinet, three localStorage keys, kept as-is:

```
imarket:<game>:best     all-time best score
imarket:<game>:daily    best score for today's seed
imarket:<game>:perfect  a "perfect run" flag for today
```

Pinball has `best` only. These keys are historical; renaming them wipes player records.

### 0.4 Determinism debt to fix in the rebuild

Neon Pinball kicks the ball off its three triangle bumpers with `Math.random()` (both
direction and spin). That is physics, not decoration, so pinball scores are not
reproducible today. The rebuild must drive those kicks from the seeded RNG.

---

## 1. Stack Tower

Precision and timing. Drop a sliding block on the tower; whatever overlaps stays.

### 1.1 Board

| Constant | Value |
|---|---|
| Logical field | 360 x 540 (portrait) |
| Block height | 28 |
| Base block width | 180 |
| Perfect tolerance | centre offset <= 3 px |

### 1.2 Controls

One action: drop the current block (click, tap, or Space). The block slides
horizontally at a per-block speed and direction supplied by the seed.

### 1.3 Placement

Let `prev` be the block underneath and `cur` the falling block.

```
left    = max(prev.x, cur.x)
right   = min(prev.x + prev.w, cur.x + cur.w)
overlap = right - left
```

- `overlap <= 0` ends the run immediately.
- The new block sits at `left` with width `overlap`.
- **Perfect**: `|centre(cur) - centre(prev)| <= 3 px`. A perfect drop keeps the full
  previous width instead of the overlap.

### 1.4 Special blocks

Kinds are drawn per block from the seed: `normal`, `gold`, `bomb`, `stone`, with
weights `bomb 0.10`, `gold 0.09`, `stone 0.07`, remainder normal.

| Kind | Effect on width | Score bonus |
|---|---|---|
| `normal` | overlap | 0 |
| `stone` | `max(overlap, prev.w * 0.75)` | +2 |
| `gold` | `min(180, prev.w + 14)` | +5 |
| `bomb` | `max(6, overlap * 0.7)` | 0 |

Order matters: the perfect-width rule applies first, then the kind modifies width.

### 1.5 Combo

Only *perfect* drops build the streak.

```
on perfect:   streak += 1;  combo = min(5, 1 + floor(streak / 3))
otherwise:    streak = 0;   combo = 1
```

### 1.6 Score

```
per block = 1 + bonus + (combo - 1)
```

So a plain drop scores 1, a gold drop at combo 1 scores 6, and a perfect chain at
combo 5 with gold scores 10.

### 1.7 Presentation

- A `FLOOR n` banner every 20 blocks (`MILESTONE = 20`).
- `PERFECT` popup on a perfect drop.
- HUD: score, best, daily best, current streak, combo multiplier.

### 1.8 End

One condition: the block misses the tower entirely (`overlap <= 0`).

---

## 2. Brick Blitz

A paddle breaker with seeded walls, a descending hazard wall and power-ups.

### 2.1 Board

| Constant | Value |
|---|---|
| Grid | 8 columns x 6 rows |
| Brick height | 20, gap 6, side padding 20, top 80 |
| Paddle | 96 wide, 12 tall, at `H - 42` |
| Ball radius | 7 |
| Ball speed | base 250 px/s, max 430 |
| Speed growth | +6 px/s per brick destroyed, capped at +320 |
| Lives | 3, maximum 6 |

Walls: left 16, right `W - 16`, top 30, bottom `H - 16`.

### 2.2 Controls

The paddle angle follows the pointer; the ball leaves the paddle along that angle. A
ghost line previews the first bounce, including a bank off the side walls.

### 2.3 Bricks

| Kind | Weight | HP | Points |
|---|---|---|---|
| `normal` | remainder | 1 | 10, 20 or 30 (seeded) |
| `armored` | 0.14 | 3 | 30 |
| `gold` | 0.09 | 1 | 100 |
| `bomb` | 0.07 | 1 | 20 |
| `moving` | 0.08 | 1 | 25 |
| `rainbow` | 0.07 | 1 | 20 |
| `steel` | 0.05 | 999 | 0 |

Gaps: `gapChance = max(0.02, 0.14 - (wave - 1) * 0.03)`, so walls densify with waves.
`steel` cannot be destroyed unless `fire` is active.

### 2.4 Combo

```
hit a brick (destroyed or damaged):  combo += 1
paddle contact:                      combo = 1
```

The combo resets on **catching the ball**, not on losing it. This is a real design
choice, not a bug, and the rebuild must preserve it or replace it deliberately.

### 2.5 Score

```
destroyed brick:  points * combo * mult
damaged brick:    5 * combo * mult
mult:             2 while "fast" is active, otherwise 1
wave cleared:     1500 + lives * 300
run ends:         2000 + lives * 500
```

Steel reads 0 points and does not break.

### 2.6 Power-ups

One in every `min(0.22, 0.1 + (wave - 1) * 0.04)` bricks carries one.

| Power-up | Effect |
|---|---|
| `expand` | wider paddle |
| `multi` | extra ball |
| `laser` | paddle fires |
| `fire` | ball destroys steel and one-shots bricks |
| `slow` | slower ball (cap 0.72 of effective max) |
| `fast` | 2x score, faster ball |
| `life` | +1 life, capped at 6 |

### 2.7 Pressure

- A hazard wall starts at `TOP - 10` and creeps down at `8 px/s + 5 px/s per wave`.
- Clearing the wall advances to a harder seeded wave.
- Losing the ball costs a life; at 0 lives the run ends.

---

## 3. Bubble Pop

A hex-grid bubble shooter with a rising tide and a finite shot budget.

### 3.1 Board

| Constant | Value |
|---|---|
| Columns | 9 |
| Colours | 5 |
| Row height | 26 |
| Starting rows | 5 |
| Seeded gaps | 15% of cells |
| Starting shots | 46 |
| Shot queue | 300 colours from the seed |
| Shot speed | 720 px/s |

### 3.2 Special bubbles

| Kind | Weight | Behaviour |
|---|---|---|
| `ice` | 0.055 | 2 HP, cracks on the first hit |
| `stone` | 0.045 | never matches a colour |
| `bomb` | 0.035 | clears blast radius `3.2 * R` |
| `gold` | 0.030 | +150 when removed |
| `rainbow` | 0.022 | wildcard, matches any colour |

### 3.3 Clearing

A shot resolves into a clear when `matches >= 3` or `removed >= 4` (a bomb blast can
qualify on volume alone).

### 3.4 Score

```
base        = 10 * clearCount * mult
mult        = 1 + min(combo, 4)
gold        = +150 per gold bubble removed
floaters    = +20 per disconnected bubble
colour clear= +200 when a colour is wiped from the board entirely
```

`combo` increments on every successful clear and resets to 1 on a dead shot.

### 3.5 Shot economy

```
refund = floor(clearCount / 4)
```

Big clears pay shots back, so efficient play extends the run.

### 3.6 Pressure

- The tide starts below the well and rises at `7 px/s + 5 px/s per wave`.
- A dead shot also nudges the tide up by 6 px.
- Wave advances every 14 bubbles cleared.

### 3.7 End

- Shots reach 0, or
- the tide overtakes a bubble, or
- the board is cleared (win).

---

## 4. Neon Pinball

A real physics table with a static layout.

### 4.1 Simulation

| Constant | Value |
|---|---|
| Table | 420 x 740 |
| Ball radius | 8 |
| Gravity | 1120 px/s^2 |
| Timestep | 1/240 s fixed |
| Max ball speed | 1600 px/s |
| Balls per run | 3 |

Model: restitution plus Coulomb friction with ball-spin coupling. Flippers inject
energy through `omega x r` contact velocity. Anti-stall nudge after 3 s of near-zero
motion.

### 4.2 Table

- 9 wall segments, restitution 0.5, drain shelves 0.4.
- 2 slingshot kickers, restitution 0.95.
- 3 pop bumpers at `(95,320)`, `(185,250)`, `(275,320)`, radius 17.
- 6 drop targets, radius 9, in two symmetric groups; all six lit triggers the jackpot.
- 3 kicker triangles, centre one enlarged.
- Flippers: pivots `(170,650)` and `(250,650)`, length 55, rest angle `+/-0.611 rad`,
  pressed `+/-1.833 rad`.
- Plunger lane at `x = 375`, rest `y = 690`, top `y = 250`; hold to charge, release to
  launch.

### 4.3 Score

| Event | Points |
|---|---|
| Pop bumper | 100 |
| Drop target | 50 |
| Slingshot | 25 |
| Kicker triangle | 150 |
| Jackpot (all six targets) | 500 |

### 4.4 Controls

`Left/A` and `Right/D` for flippers, `Space` (hold) for the plunger.

### 4.5 End

Three balls lost down the drain.

---

## 5. Daily Puzzle (the fifth mode, for completeness)

One puzzle per UTC day, type chosen by `hashSeed(date + ":type") % 3`.

| Type | Title | Attempts |
|---|---|---|
| `word` | Daily Anagram | 5 |
| `math24` | Make 24 | 10 |
| `sequence` | What Comes Next? | 3 |

Answers are generated and checked server-side; the public payload carries no answer
material. Known defect: `POST /api/puzzles/verify {reveal:true}` returns the answer for
any date, unauthenticated, which must be closed before any paid mode exists.

---

## 6. Constraints for the 3D rebuild

Decided, from the current direction:

1. **Camera**: a slight angle, like a person standing at a cabinet. Not perpendicular.
   The screen plane tilts away from the viewer so the cabinet reads as a solid object.
2. **Physics**: realistic, meaning a proper solver with restitution, friction, mass and
   spin, not a pseudo-physics animation.
3. **Determinism survives both.** A realistic solver is still deterministic when it is
   fixed-step, seeded, and iterates contacts in a stable order. "Realistic" and
   "reproducible" are compatible; "random" and "reproducible" are not.
4. **The simulation plane stays 2D for the arcade games.** The third axis belongs to
   presentation and to the ball in Brick Blitz and Pinball, where depth is visible but
   the solve remains planar. This is how the pinball keeps its feel when the table
   becomes an object.

## 7. Open questions the rebuild must answer

1. Does Brick Blitz's combo really reset on paddle contact, or should it decay instead?
2. Should Stack Tower keep the fixed 360 x 540 playfield ratio in 3D, or scale to the
   cabinet's real proportions?
3. Pinball's bumper kicks become seeded. Does that change difficulty enough to need
   re-tuning?
4. Are the `imarket:*` keys migrated or reset before launch?
