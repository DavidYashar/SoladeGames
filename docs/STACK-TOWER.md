# Stack Tower: current state

Last updated 2026-11-11. This describes the game **as it exists in code today**, not the
plan. `docs/GAME-RULES.md` is earlier work and describes the *previous* game (a sliding
stack of shrinking blocks). That game was deleted; its rules file is kept only as a
record of mechanics we may reuse.

---

## 1. The game

A turn-based tower extraction game against a deterministic opponent.

| Rule | Value |
|---|---|
| Tower | 18 layers, 3 planks per layer, each layer rotated 90° |
| Plank proportions | 3.0 x 1.0 x 0.6 world units (real 75 x 25 x 15 mm) |
| Turn | Player and machine alternate, one extraction each |
| Extraction | Click a plank; it slides out along its long axis |
| Placement | Player carries the extracted plank and drops it on top |
| Forbidden | The top layer cannot be chosen |
| Constraint | A layer must keep at least 1 plank |
| Collapse | Any plank more than one layer below where its layer belongs |
| Loss | The side whose move collapses the tower |
| Win | The other side |

### Collapse rule (Option 3)

After every action the tower settles fully (up to 2.5 s of simulated time) before
anyone is judged. A weakened tower that would fall later falls *now*, so the collapse is
charged to the move that caused it rather than the next player's turn.

---

## 2. How it plays

| Step | Input |
|---|---|
| Look around | drag empty space (left or right button) |
| Pull a plank | click it |
| Take the plank | press the plank that appears on top and hold |
| Position it | move the mouse; the plank follows over the tower top |
| Rotate it | `R` |
| Place it | release the button |

The carried plank sits at its landing height, so the preview is where it lands, not a
hologram above it. Orbiting is disabled only while a plank is held.

---

## 3. Architecture

```
web/lib/jenga/tower.ts     layout, plank dimensions, pull distance and timing
web/lib/jenga/sim.ts       Rapier world: build, pull, place, settle, fallen, probe
web/lib/jenga/state.ts     body snapshot and restore, for probes
web/lib/jenga/policy.ts    the opponent: ranking, verification, placement choice
web/lib/jenga/sandbox.ts   headless experiments
web/app/api/jenga/sandbox  HTTP entry point for the experiments
web/components/games/stack-tower-3d.tsx   the scene, input, turn machine, HUD
```

The simulation is framework-free on purpose: the browser, the API route and any future
Node test all run the same code.

### Physics

Rapier, fixed 1/120 timestep, friction 0.72, restitution 0.02, density 0.8. Gravity is
-18 in world units. Solver iterations raised to 12 with 6 extra friction iterations,
because a 30-plank tower sinks under the defaults.

Two decisions matter more than the settings:

1. **The extracted plank stops colliding while it slides.** A kinematic body has
   infinite mass, so with wood friction it drags its neighbours and throws them metres
   away. Measured: 11 units of displacement with collision on, 0.05 to 0.24 with it off.
   The remaining planks carry the load, which is physically correct anyway.
2. **Fall detection is relative to the plank's own layer.** The first version asked "is
   it below the table", which missed the common failure: a plank sliding off the top and
   landing *on* the table at a normal height. That bug caused a player to win a game they
   had lost.

---

## 4. The opponent

Not AI. Two deterministic stages, no randomness anywhere.

**Stage 1, closed form.** For each legal plank:

```
margin      = distance from the centre of mass above, to the nearest edge of the
              support rectangle left behind
load        = planks above / 54
supportLeft = planks remaining in that layer
height      = layer / 17
risk = -margin*2.2 + load*3.0 + (3-supportLeft)*1.1 - height*1.6
       + 1000 if margin < 0
```

Positions come from the **live physics bodies**, not the original layout. This was a bug
for a while: the model judged the tower as built, not as it currently stood.

**Stage 2, verification.** The top 8 candidates are each simulated on a snapshot: lift
the plank out, step 45 ticks, measure, restore. A move is eligible only if nothing fell,
displacement stayed under 0.5, and the resulting tower still has a positive worst margin.
Among eligible moves it picks the one that **maximises the worst support margin of the
tower it leaves behind**.

Probe depth is load-bearing, measured:

| Candidates x ticks | Collapses in 40 moves |
|---|---|
| 4 x 30 | 2 of 2 |
| 8 x 20 | 3 of 3 |
| **8 x 45** | **0 of 3** |

A shallow probe misses slow failures: the tower looks fine at 20 ticks and fails at 35.

---

## 5. Measured behaviour

| Scenario | Result |
|---|---|
| Model vs model, 40 moves, 3 runs | 0 collapses |
| Random vs model, 6 runs | 4 collapses, **all charged to the player** |
| Machine turn duration | roughly 2 to 3 seconds (think + 8 probes + pull) |
| Single probe cost | about 198 ms in the browser |
| Untouched tower settling | zero self-collapse |

---

## 6. Test tooling

`GET /api/jenga/sandbox`

| Query | Meaning |
|---|---|
| `?mode=policy&trials=3&pulls=40` | both sides play the model |
| `?mode=random&trials=6&pulls=40` | both sides pick at random |
| `?mode=mixed&trials=6&pulls=60` | player random, machine the model |
| default | random pulls only, no placement |

Debug handles on `window`, for driving the scene without a mouse:

```
window.__jenga   the simulation (planks, fallen(), probe(), settle())
window.__game    state(), drop(x, z, alongX), rank(), heldScreen(), cameraPos()
```

---

## 7. Known issues

1. **No restart.** A finished game requires a page refresh.
2. **No score.** You win or lose; nothing counts.
3. **Placeholder art.** Flat brown boxes under plain lighting. None of the wood
   reference is implemented.
4. **The camera does not follow the tower** as it grows; very tall towers leave the frame.
5. **Machine think time** blocks the scene for 2 to 3 seconds.
6. **Out-of-bounds drop** clamps to the tower edge instead of returning the plank.
7. **No sound.**
8. **Touch input untested.** The carry gesture assumes a mouse.
9. **Debug handles ship in the bundle.** Harmless, but should be dev-only.
10. **No automated tests** beyond the sandbox endpoints. Nothing guards the policy from
    regressions.

---

## 8. What remains

Ordered as I would do it.

1. **Restart and score.** Turns a demo into a game. Small.
2. **Camera that frames the tower** as it grows. Small, and the most likely annoyance.
3. **The wood.** Grain, bevelled edges, warm key light, dark studio, matching the
   reference image. This is the largest visual step and touches the Blender pipeline.
4. **Machine speed.** Move the probes into a worker so the scene never blocks.
5. **Pull resistance.** The plank comes out weightlessly; scaling resistance by the load
   it carries would add feel and information.
6. **Out-of-bounds release** returns the plank to the hand.
7. **Touch support**, if this is to be played on a phone.
8. **Determinism and replay**, if scores are ever to be trusted, plus anti-cheat if a
   leaderboard is attached.
9. **The hall**, which we deferred: a 3D room around the cabinets.
