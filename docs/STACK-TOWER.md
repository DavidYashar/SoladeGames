# Stack Tower: current state

Last updated 2026-11-11. This describes the game **as it exists in code today**.
`docs/GAME-RULES.md` is superseded: it describes the earlier sliding-stack game, which
was deleted.

---

## 1. The game

A turn-based tower extraction game against a deterministic opponent.

| Rule | Value |
|---|---|
| Tower | 18 layers, 3 planks per layer, each layer rotated 90° |
| Plank proportions | 3.0 x 1.0 x 0.6 world units (real 75 x 25 x 15 mm) |
| Turn | Player and machine alternate, one extraction each |
| Turn limit | **2 minutes per turn**; running out loses the game |
| Extraction | Click a plank; it slides out along its long axis |
| Resistance | Extraction time scales with the load the plank carries |
| Placement | Carry the plank and drop it anywhere over the tower top |
| Forbidden | The top layer cannot be chosen |
| Constraint | A layer must keep at least 1 plank |
| Collapse | Any plank more than one layer below where its layer belongs |
| Loss | The side whose move collapses the tower, or whose clock runs out |
| Score | 1 point per safe extraction, **2** for a pull from the lower half |

### Collapse rule (Option 3)

After every action the tower settles fully (up to 2.5 s of simulated time) before
anyone is judged. A weakened tower that would fall later falls now, so the collapse is
charged to the move that caused it rather than to the next player.

---

## 2. How it plays

| Step | Input |
|---|---|
| Look around | drag empty space (left or right button) |
| Pull a plank | click it |
| Take the plank | press the plank that appears on top and hold |
| Position it | move the mouse; the plank follows over the tower top |
| Rotate it | `R` |
| Place it | release the button, inside the tower area |
| Keep it | release outside the tower and the plank stays in your hand |
| Play again | the button on the game-over screen |

The carried plank sits at its landing height, so what you see is where it lands.
Orbiting is disabled only while a plank is held.

---

## 3. Architecture

```
web/lib/jenga/tower.ts     layout, plank dimensions, pull distance and timing
web/lib/jenga/sim.ts       Rapier world: build, pull, place, settle, fallen, probe
web/lib/jenga/state.ts     body snapshot and restore, for probes
web/lib/jenga/policy.ts    the opponent: ranking, verification, placement choice
web/lib/jenga/wood.ts      procedural wood textures (canvas, no external assets)
web/lib/jenga/sandbox.ts   headless experiments
web/app/api/jenga/sandbox  HTTP entry point for the experiments
web/components/games/stack-tower-3d.tsx   scene, input, turn machine, HUD
```

The simulation is framework-free: the browser, the API route and any future Node test
run the same code.

### Physics

Rapier, fixed 1/120 timestep, friction 0.72, restitution 0.02, density 0.8, gravity -18.
Solver iterations raised to 12 with 6 extra friction iterations, because a 30-plank tower
sinks under the defaults.

Two decisions matter more than the settings:

1. **The extracted plank stops colliding while it slides.** A kinematic body has infinite
   mass, so with wood friction it drags its neighbours and throws them metres away.
   Measured: 11 units of displacement with collision on, 0.05 to 0.24 with it off.
2. **Fall detection is relative to the plank's layer.** The first version asked "is it
   below the table", which missed the common failure of a plank sliding off the top and
   landing on the table at a normal height. That bug let a player win a game they lost.

---

## 4. The opponent

Not AI. Two deterministic stages, no randomness.

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

Positions come from the **live physics bodies**, not the original layout.

**Stage 2, verification.** The top 8 candidates are each simulated on a snapshot: lift the
plank out, step 45 ticks, measure, restore. A move is eligible only if nothing fell,
displacement stayed under 0.5, and the resulting tower still has a positive worst margin.
Among eligible moves it picks the one that **maximises the worst support margin of the
tower it leaves behind**.

Probe depth is load-bearing, measured:

| Candidates x ticks | Collapses in 40 moves |
|---|---|
| 4 x 30 | 2 of 2 |
| 8 x 20 | 3 of 3 |
| **8 x 45** | **0 of 3** |

---

## 5. Visuals

- Procedural wood: a canvas-generated colour and roughness map, no external assets.
- Rounded plank edges (0.035 radius), alternating light and dark planks per orientation.
- Warm key light, cool fill, warm back light, ACES tone mapping.
- Dark studio floor with a contact shadow.
- The camera is deliberately fixed: the owner asked for it to stay as it is.

---

## 6. Measured behaviour

| Scenario | Result |
|---|---|
| Model vs model, 40 moves, 3 runs | 0 collapses |
| Random vs model, 6 runs | 4 collapses, all charged to the player |
| Machine turn duration | roughly 2 to 3 seconds |
| Single probe cost | about 198 ms in the browser |
| Untouched tower settling | zero self-collapse |

---

## 7. Test tooling

`GET /api/jenga/sandbox`

| Query | Meaning |
|---|---|
| `?mode=policy&trials=3&pulls=40` | both sides play the model |
| `?mode=random&trials=6&pulls=40` | both sides pick at random |
| `?mode=mixed&trials=6&pulls=60` | player random, machine the model |
| default | random pulls only, no placement |

Debug handles on `window`:

```
window.__jenga   simulation (planks, fallen(), probe(), settle())
window.__game    state(), drop(x, z, alongX), heldScreen(), plankScreen(id)
```

---

## 8. Known issues

1. **Machine think time** blocks the scene for 2 to 3 seconds.
2. **No sound.**
3. **Touch input untested.** The carry gesture assumes a mouse.
4. **Debug handles ship in the bundle.** Harmless, should be dev-only.
5. **No automated tests** beyond the sandbox endpoints.
6. **HUD sits over the tower base** on short screens; readable, but it hides the bottom plank.
7. **Overlapping drops are allowed.** Dropping a plank onto another in the same layer is
   resolved by physics rather than refused, which can raise the layer count.

---

## 9. What remains

1. **Touch support**, if this is to be played on a phone.
2. **Machine speed**: move the probes into a worker so the scene never blocks.
3. **Sound.**
4. **Overlap refusal** or a clearer placement rule when a slot is occupied.
5. **Determinism and replay**, if scores are ever to be trusted on a leaderboard.
6. **The hall**, deferred: a 3D room around the cabinets.
