# SolAde Games

> A skill arcade of three machines, built to run on Bankroll's rails.

![The hall](web/public/billboards/stack-tower.png)

---

## 1. What this is

SolAde Games is **content**: three deterministic skill games, presented as a walkable
arcade hall. It is built to be a title that launches on **Bankroll**, using their
payments, age checks and matchmaking rather than carrying any of that ourselves.

**What we are not:**

- Not a competing payments platform. Payments, custody and age checks are Bankroll's.
- Not a token. There is no game currency and no emissions.
- Not taking a platform rake. The house does not charge the pot.

**What we are:** the games, and the machines people can own. Every paid entry is
split between the prize pool and the holders of the machine being played. The share
is published before the first entry is taken.

The arcade wins when players keep playing. That works when the money rails are
someone else's job, run by someone with the licences for it, and when the people who
back the hall have a reason to keep backing it.

---

## 2. The three games

All three are playable now, in the browser, at the routes below.

| Machine | Route | What it is |
|---|---|---|
| **Stack Tower** | `/games/stack-tower` | Pull a plank from the tower and place it on top. Real physics, a real opponent. |
| **Brick Blitz** | `/games/brick-blitz` | Brick breaker on a billiard table. Six materials, each with its own hit, sound and score. |
| **Neon Pinball** | `/games/pinball` | A full pinball table: flippers, bumpers, slingshots, a plunger, and bells in A minor pentatonic. |

Each machine has its own 3D scene, its own synthesised or recorded sound design,
and its own rules. They are not reskins of one game.

**Also present:** a daily puzzle at `/play`, with server-side answer checking. It is
gated behind a player handle, so it is not playable for a first-time visitor.

**Not present:** Bubble Pop. It existed in an earlier scope and is not in this code.

---

## 3. The machines

A machine is the NFT for a cabinet. It is what turns a tester into someone with a
stake in the hall being busy.

- **Holders earn from play.** A share of every paid entry on a cabinet goes to the
  holders of that cabinet's machines. It is paid because the hall is being used, not
  because a token inflated.
- **A machine is not an advantage.** It does not raise a score, unlock a board, or buy
  a leaderboard position. Everyone plays the same board, holders included.
- **Machines are earned before they are sold.** The first ones are minted by players
  who earned them during the season, not sold as a promise of profit.
- **Machines are tradeable.** A normal NFT, owned outright. The secondary market prices
  a machine against the fees its cabinet actually generates.

**Not decided yet:** the holder share percentage, the mint size, the season rules, and
whether machines are ever sold directly. The business plan is kept in
[`docs/archive/Games-Business-Plan.md`](docs/archive/Games-Business-Plan.md) and marked
in development, because we have not settled it.

**The tension to resolve with Bankroll:** if they take no cut and we take no cut, the
holder share is still money leaving the pot. Whether that is acceptable on their rails,
and who funds the art and the season before any fees exist, are the two questions that
decide this. They are listed in section 7.

---

## 4. What is live today, precisely

- The three cabinets, free to play, no wallet required to start.
- The hall: a 3D front door, a wooden bar, and three stations you click to enter.
- Wallet connect on **Solana devnet**, with a player profile and per-game bests.
- The daily puzzle and its API, gated behind a handle.

**What is not live:** any payment. No entry fees, no prize pools, no USDC movement,
no settlement. Devnet-only scripts for league settlement exist in `scripts/`, but
nothing is running and no funds move.

**On the chain question:** the wallet layer is Solana devnet, because that is the
client we built and tested. Settlement is deliberately unimplemented, pending the
decision below. There is no live USDC anywhere in this product.

---

## 5. Why the games are worth putting on your rails

- **Deterministic boards.** Every board, wall and table is generated from a fixed
  seed, so two players in the same round face the same machine. A score means
  something across wallets.
- **Physics, not animation.** Pinball runs a fixed-timestep rigid body simulation;
  Stack Tower uses real bodies, so a pull can genuinely topple the tower.
- **Sound that is played, not looped.** Material hits are triggered per contact,
  measured for onset and level on load.
- **A skill arcade is a content business.** The games are the product; they need a
  home with an audience, which is what Bankroll has and what we do not.

---

## 6. What we would need from Bankroll

| Capability | Why we are not doing it ourselves |
|---|---|
| **Payments and settlement** | Licensed, and we take no cut of game revenue. |
| **Age checks** | Required for paid play; we have no process for it. |
| **Matchmaking and lobbies** | Bankroll already has an audience to match against. |
| **Custody and payouts** | Someone with the compliance posture has to hold the money. |

## 7. What we bring

- Three finished, playable games with distinct mechanics.
- A presentation layer that makes them feel like a room rather than a menu: an
  entrance, a bar, three stations, a lit sign, ambient sound.
- A Next.js client, a small API surface, and an art pipeline (Blender scripts plus
  a PNG-to-3D route) that turns supplied artwork into 3D scene assets.

---

## 8. Open questions for Bankroll

These are the questions that decide what this becomes. None of them are answered
by code in this repository.

1. **The holder share.** A published share of each paid entry goes to machine holders.
   Is that acceptable on your rails, and who administers the split?
2. **Settlement model.** Do you settle per round, per session, or per league, and in
   what asset?
3. **Age gating.** Is it per account, per jurisdiction, or per payment method?
4. **Matchmaking.** Do we hand you a queue request, or do you host the lobby and hand
   us a session?
5. **Custody.** Are player balances held by Bankroll and exposed to us as an API, or
   does the player sign each round?
6. **Porting.** Do you want the three games as-is, or a single title from this set as a
   first integration?
7. **Funding the season.** The art, the sound and the machines exist. A season with no
   fees yet has no holder share to pay out. Does Bankroll fund titles it wants, and on
   what terms?

---

## 9. How the code is organised

```
web/                    Next.js 16 app (React 19, Tailwind 4)
  app/                  routes: hall, three games, puzzle, profile, docs
  components/games/     one component per machine, each self-contained
  components/hall/      the 3D entrance and room
  lib/                  per-game rules, physics glue and audio engines
  public/               models, textures, billboards, audio
art/                    Blender scripts that build the 3D scene assets
docs/                   design and state notes per cabinet
```

**Stack:** Next.js 16, React 19, three.js with react-three-fiber, Rapier for physics,
Web Audio for sound, Blender for scene assets.

**Build and run:**

```bash
cd web
npm install
cp .env.example .env.local   # database and devnet settings
npm run dev
```

The three games run entirely in the browser and need no backend. The account API
needs Postgres.

---

## 10. Status

| Area | State |
|---|---|
| Three cabinets | Playable, sound complete |
| Hall | Entrance, bar, three stations, sign |
| Wallet and profile | Solana devnet |
| Daily puzzle | Present, gated behind a handle |
| Payments | **Not implemented, by design** |
| Machines (NFT, holder share) | Designed, not built |
| Token | None, and not planned |

*SolAde Games, 13 November 2026. Prepared for review by Bankroll.*
