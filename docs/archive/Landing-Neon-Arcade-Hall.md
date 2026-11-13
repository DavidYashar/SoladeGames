> Historical planning document. Kept for reference; the current direction is the
> [README](../../README.md).

# Neon Arcade Hall — Main Landing Spec

> **Audience:** another AI (or human) implementing the `/` page of I-Market Games.
> **Scope:** frontend landing page only (`games/web`). Do **not** touch `I-Market/`.
> **Status:** design locked as the recommended homepage. Implement this, not a casino brochure.
> **Related:** [Games-Business-Plan.md](Games-Business-Plan.md), current app in `games/web/`.

This document is the single source of truth for the **Neon Arcade Hall** landing. If the live page disagrees with this file, this file wins.

---

## 0. One-sentence product

A **skill arcade hall** on Arc: pick a machine, practice free, optionally pay **USDC** to compete. Same seeded board for everyone. Winners, NFT holders, and the platform split **real USDC that players paid in**. Nothing is printed.

It is **not** a casino, not slots, not P2E token farming.

---

## 1. Why this landing exists

Locked product decisions (from the business plan):

| # | Decision |
|---|---|
| 1 | Main page = **game hall** (choose a machine) |
| 2 | Launch machines: Stack Tower, Brick Blitz, Bubble Pop (+ Pinball already built) |
| 3 | Free practice always; paid round = **0.10 USDC**; **50% of round fee → NFT holders** |
| 4 | Daily tournament = **1 USDC**, best score at **24h UTC cutoff**, split **60% winner / 20% team / 20% NFT holders** |
| 5 | Daily Puzzle League is a second rail (word / math24 / sequence, rotating) |
| 6 | NFTs = **revenue claim** (“own the arcade”), not the homepage pitch |
| 7 | Rewards in **USDC on Arc** (stable, sub-second finality, cheap gas) |

The current `/` fights those decisions: casino branding, 🎰 emoji, text-only hero, emoji machine cards, fake activity, mixed split numbers, wallet-first “how it works”.

**This redesign:** walk into a neon hall. Machines first. Money second. Wallet last.

---

## 2. Brand

### 2.1 Name on the landing

Use **I-Market Arcade** (header lockup) with a quieter subtitle **Arcade King**.

- Header: `I-MARKET` + gradient `ARCADE`
- Optional small kicker under logo: `Arcade King`
- Document title / metadata: `I-Market Arcade` — not “Casino”, not only “I-market Games”

**Do not use:** Casino, 🎰, jackpot, spin, bet, wager, slots, house edge, luck.

**Do use:** arcade, hall, machine, cabinet, skill, practice, compete, seeded board, USDC, settle.

### 2.2 Voice

Short, physical, present-tense. Like a hall attendant, not a whitepaper.

Good:

- Play for skill. Settle in USDC.
- Same board for everyone. Best score at midnight UTC.
- Free practice. One USDC to enter tonight.

Bad:

- Step into the I-Market Casino
- On-chain & auditable
- Transparent by design (as a headline)
- Connect your wallet (as step 1)

### 2.3 Visual world

- **Room:** near-black hall `#08060c` / `#0b0a14`
- **Light:** amber cabinets `#f7c948`, cyan `#22d3ee`, fuchsia `#a78bfa`, mint `#34d399`
- **Floor:** subtle perspective grid or vignette, not a particle snowstorm in front of content
- **Type:** existing Geist / Geist Mono is fine. Headlines black/tight. Numbers mono.
- **Shape language:** cabinets = rounded rectangles with a **bezel** (inner screen + outer frame), not flat emoji cards
- Keep the gold/cyan ambient radial glows already on `app/page.tsx`

Particle background may stay **behind** content at low opacity. It must never compete with cabinet screens.

### 2.4 Legal / positioning guardrail

Paid play is **skill competition funded by entry fees**. Copy must never imply chance, RNG loot, or “the house” taking a hidden cut. The free tier is always available and must be the first CTA.

---

## 3. Information architecture

Single long page. No extra routes required for v1.

```
[sticky header]
[hero — hall + live cabinets + two CTAs]
[tonight — daily tournament]
[today — daily puzzle]
[money — how USDC moves]
[own — machine NFTs, short]
[fair — seeded / skill / Arc]
[footer]
```

**Do not include on v1 homepage:**

- Fake “Live on Arc” activity feed
- Empty “Total USDC in pots —”
- Empty “Players today —”
- Wallet as the first how-it-works step
- A giant donut as a sibling of the NFT pitch (donut belongs inside Money, if at all)

Anchor ids (keep these so nav works):

| Id | Section |
|---|---|
| `#machines` | Hero hall / cabinet row (the hall *is* the machines) |
| `#tournament` | Tonight |
| `#puzzle` | Today’s puzzle |
| `#money` | How USDC moves |
| `#nft` | Own a machine |
| `#fair` | Fairness |

---

## 4. Page composition (what `/` renders)

File: [games/web/app/page.tsx](web/app/page.tsx)

Replace the current stack with:

```tsx
<ArcHeader />
<main>
  <HallHero />          // machines + headline + CTAs
  <TournamentBanner />  // rewrite in place
  <FeaturedPuzzle />    // keep data, restyle + id="puzzle"
  <MoneyFlow />         // new — replaces LiveStats + SplitDonut pair
  <OwnershipSection />  // shorten, keep id="nft"
  <FairnessSection />   // new — replaces HowItWorks
</main>
<Footer />
```

`ParticleBackground` may wrap the page as today.

Remove from `/`:

- `LiveStats` (or gut it — do not show em dashes)
- `ActivityFeed`
- The two-column “Ownership + Transparent donut” grid
- `HowItWorks` (wallet → load USDC → play)

Keep as files if useful, but **do not mount** them until they have real data.

---

## 5. Header — `ArcHeader`

File: [games/web/components/landing/arc-header.tsx](web/components/landing/arc-header.tsx)

### Brand

- Drop 🎰
- Logo mark: a simple neon cabinet glyph (CSS/SVG rectangle with a lit screen) **or** a 🕹️ / arcade-cabinet unicode — **not** a slot machine
- Wordmark: `I-MARKET ARCADE`

### Nav (desktop)

1. Machines → `#machines`
2. Tonight → `#tournament`
3. Puzzle → `/play` (also `#puzzle` is ok as in-page, but Puzzle should be a real route too)
4. Own → `#nft`

Remove a separate “Daily Puzzle” vs “Game Rooms” mismatch: **Machines** is the hall, **Puzzle** is the other product.

### Right cluster

- Keep `Arc Testnet` pulse badge
- Keep `ConnectWallet`
- Wallet is **available**, not a CTA in the hero

### Mobile

- Logo + testnet + wallet
- Nav can collapse; machines are visible in the hero so missing nav is OK on small screens

---

## 6. Hero — Neon Hall (`HallHero`)

**Goal:** the first viewport is a room of machines, not a manifesto.

### Layout (desktop, `max-w-6xl`)

```
kicker
headline
subhead
[ Play free ]  [ Today's puzzle ]

  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │ Tower  │ │ Brick  │ │ Bubble │ │Pinball │
  │ screen │ │ screen │ │ screen │ │ screen │
  │ bezel  │ │ bezel  │ │ bezel  │ │ bezel  │
  └────────┘ └────────┘ └────────┘ └────────┘
```

On mobile: headline + CTAs, then a **horizontal snap-scroll** of cabinets (not a 2×2 that shrinks screens to unreadable).

### Copy (lock this)

**Kicker:** `Skill arcade · USDC on Arc · Free practice`

**Headline:** `Play for skill. Settle in USDC.`

**Subhead:** `Walk the hall. Same seeded board for every player. Practice free — or put 1 USDC on tonight’s tournament. Best score at midnight UTC wins.`

**Primary CTA:** `Play free` → `/games/stack-tower` (flagship launch machine)

**Secondary CTA:** `Today’s puzzle` → `/play`

Do **not** put “Connect wallet” or “Enter a Game Room” (too vague) on the hero.

### Cabinets — this is the product

Four cabinets, in this order (launch set + pinball):

| Order | Name | Route | Control hint | Accent |
|---|---|---|---|---|
| 1 | Stack Tower | `/games/stack-tower` | Tap to drop | cyan |
| 2 | Brick Blitz | `/games/brick-blitz` | Drag / track the paddle | amber |
| 3 | Bubble Pop | `/games/bubble-pop` | Aim, shoot, chain | pink |
| 4 | Neon Pinball | `/games/pinball` | Flippers · plunger | violet |

Each cabinet is a **link** to its route (same as today’s `MachinesGrid`).

#### Cabinet chrome

Treat each card as an arcade cabinet:

1. **Marquee** — game name, neon
2. **Bezel** — dark frame
3. **Screen** — the game, not an emoji
4. **Control deck** — one-line hint + badges
5. **Coin door** — `Free practice` always; `1 USDC tonight` if this machine is today’s tournament host

Hover: lift 4px, brighter bezel, screen bloom in the machine’s accent color.

#### What goes on the screen (implementation order)

**v1 (required):** static **art poster** per machine — CSS scene that *looks* like the game:

- Stack Tower: stacked rounded slabs, shrinking width, cyan/teal
- Brick Blitz: paddle + ball + brick wall, amber
- Bubble Pop: hex cluster of colored bubbles, pink
- Pinball: table silhouette, ball, two flippers, violet

These can be pure Tailwind/CSS in the cabinet component. No new assets required.

**v1.5 (preferred if cheap):** looping `<video>` or APNG in `public/hall/` (3–5s, muted, no UI chrome). Capture from the real canvas later.

**Do not** mount the full `StackTowerGame` etc. on the homepage. Those canvases are heavy, steal pointer events, and have the overlay-click bug. Homepage screens are **previews**, not playable games.

#### Personal best

Client-only, after mount:

```
imarket:stack-tower:best
imarket:brick-blitz:best
imarket:bubble-pop:best
imarket:pinball:best
```

If a number exists, show `Best {n}` on the control deck. If not, omit the line (do not show `Best 0` or `Best —`).

#### Tags on the coin door

- Always: `Free practice`
- Tournament host (Stack Tower for now): extra chip `Tonight · 1 USDC`
- Never: “Coming soon” on a playable machine

### Section heading

Small uppercase label above the row:

`The hall`  
right meta: `Enter a cabinet to practice`

Keep `id="machines"` on this section (hero includes the hall).

---

## 7. Tonight — daily tournament

File: rewrite [games/web/components/landing/tournament-banner.tsx](web/components/landing/tournament-banner.tsx)

Keep [tournament-countdown.tsx](web/components/landing/tournament-countdown.tsx) (UTC midnight). Do not change the cutoff.

### Copy

**Kicker:** `Tonight`

**Title:** `Stack Royale`

**Machine line:** `Stack Tower · same seeded board`

**Body:** `Pay 1 USDC. Play for your best score. Highest score when the clock hits 00:00 UTC takes 60% of the pot.`

**CTA:** `Practice the board` → `/games/stack-tower`  
Secondary (optional): `How entry works` → `#money`

### Pot

Until the fee engine is live:

- Do **not** show `— USDC`
- Show: `Pot goes live with paid entries`
- Sub: `Every USDC in the pot came from a player`

When live, replace with a real on-chain number and the word `USDC`.

### Split (lock — do not mix with league split)

This section is the **arcade daily tournament**:

| Share | Party | Color |
|---|---|---|
| 60% | Winner | amber `#f7c948` |
| 20% | Team | cyan `#22d3ee` |
| 20% | NFT holders | fuchsia `#a78bfa` |

Use the existing bar. Label it `Tonight’s split` so it cannot be confused with the puzzle-league 60/25/15.

### Host machine

v1 host = **Stack Tower** (already in the banner). Later, rotate host per day; until then hardcode Stack Tower and say so.

---

## 8. Today — daily puzzle

File: restyle [games/web/components/landing/featured-puzzle.tsx](web/components/landing/featured-puzzle.tsx)

Keep `getDailyPuzzle(dateKey())` — it is already live (e.g. Make 24). **Never ship the answer to the client.**

Add `id="puzzle"`.

### Layout

Wordle energy: compact, date-forward, one action.

```
Daily Puzzle League · {date}
{icon} {title}
{blurb}
{attemptsAllowed} attempts · free to play
[ Play today → ]  /play
```

Icons already in file: word 🔤, math24 🔢, sequence 🧩.

### Copy tweaks

- Kicker: `Today’s puzzle` (not “Daily Puzzle League · Live” if that implies a paid league is live)
- If paid leagues are not live, one quiet line: `Free today. Paid Copper / Silver / Gold leagues when the contract is up.`
- Do not embed the puzzle UI on `/`. Deep-link to `/play`.

### Visual

Keep the amber→cyan wash. Make it **narrower in height** than a cabinet — puzzle is rail 2, not the hall.

---

## 9. Money — how USDC moves (`MoneyFlow`, new)

Replaces `LiveStats` + the orphan donut.

**Purpose:** one honest diagram so a new player knows what 0.10 and 1.00 mean.

### Headline

`Every dollar in was paid by a player.`

Sub: `No game token. No emissions. USDC on Arc, split on-chain.`

### Two rails (cards)

**A. Per-round play**

- Cost: `0.10 USDC` deducted from the player account
- Split: `50% → NFT holders` · remainder TBD (say **TBD**, do not invent 25/25)
- Note: free practice does **not** deduct

**B. Daily tournament**

- Cost: `1.00 USDC` once per machine per day
- Split: `60% winner / 20% team / 20% NFT holders`

### Puzzle league (tertiary, one line)

`Puzzle leagues (when live): Copper 0.10 · Silver 0.50 · Gold 1.00 USDC · split 60% winners / 25% League Seats / 15% platform.`

Keep this visually quieter so it does not collide with the 60/20/20 bar above.

### Empty / testnet honesty

If contracts are not paying yet, a single banner:

`Testnet build. Practice is live. USDC splits go live with the fee engine.`

No fake pots, no fake player counts, no fake feed.

### Donut

If you keep `SplitDonut`, it must be parameterized.

- Tournament donut: 60 / 20 / 20
- League donut: 60 / 25 / 15

**Never** hardcode 60/25/15 next to tournament copy. The current page does this and it is a trust bug.

---

## 10. Own — machine NFTs

File: shorten [games/web/components/landing/ownership-section.tsx](web/components/landing/ownership-section.tsx)

This is **beat 5**, not the hero.

### Copy

**Kicker:** `Machine NFTs`

**Title:** `Own the machine people play.`

**Body:** `Each Arcade Machine NFT is a claim on real play. Holders earn USDC from round fees and tournament pots — because the hall is in use, not because a token inflated.`

Bullets (keep factual):

- 50% of every **paid** round fee
- 20% of daily tournament pots
- Fixed supply (plan: 5,000 machines — mark as **plan**, not minted, until the collection exists)
- Marketplace · Coming soon (disabled button is OK)

Do not promise live yield, claimable balances, or token IDs until the account page exists.

No donut beside this block.

---

## 11. Fair — why this isn’t P2E (`FairnessSection`, new)

Replaces wallet-first `HowItWorks`.

Three tiles, **play-shaped**:

| # | Title | Body |
|---|---|---|
| 01 | Same board | Daily seed. Every tournament player faces the identical machine. |
| 02 | Skill, not chance | Best score wins. Free practice is unlimited and never paid. |
| 03 | USDC on Arc | Entries and payouts are dollars, settled in under a second. No death-spiral game token. |

Optional fourth (only if it fits the grid without wrapping badly): `On-chain split` — anyone can verify the cut; we do not hide rake.

Do **not** start with “Connect your wallet”. Wallet belongs in the header when they choose to enter a paid round.

---

## 12. Footer

File: [games/web/components/landing/footer.tsx](web/components/landing/footer.tsx)

- Wordmark: `I-MARKET ARCADE`
- Tagline: `Play · Compete · Own the hall — settled in USDC on Arc.`
- Links: Machines, Tonight, Puzzle (`/play`), Own
- Keep chain line: `Chain ID 5042002 · rpc.testnet.arc.io`
- Keep: `Testnet build — on-chain rewards go live with mainnet.`
- Drop casino language

---

## 13. Metadata

File: [games/web/app/layout.tsx](web/app/layout.tsx)

```
title: I-Market Arcade
description: Skill arcade and daily puzzle league. Practice free, compete in USDC on Arc.
```

---

## 14. What to delete, hide, or stop saying

| Current | Action |
|---|---|
| “I-Market Casino” / 🎰 | Remove everywhere on landing |
| Hero “Step into the Casino” | Replace with locked headline |
| `LiveStats` em dashes | Do not render |
| `ActivityFeed` placeholder rows | Do not render |
| How it works: Connect → Load USDC → Play | Replace with Fairness |
| Split 60/25/15 shown as “the” payout | Label as **puzzle league only** |
| “Enter a Game Room” | `Play free` + named machines |
| Wallet as first CTA | Header only |
| `Best 0` / `— USDC` / “pending live data” | Omit or honest sentence |

---

## 15. Component / file map

All paths under `games/web/`.

| File | Change |
|---|---|
| `app/page.tsx` | New section order (this spec §4) |
| `app/layout.tsx` | Title + description |
| `components/landing/arc-header.tsx` | Rebrand + nav |
| `components/landing/hero.tsx` | Replace with hall hero **or** new `hall-hero.tsx` and delete old hero |
| `components/landing/machines-grid.tsx` | Fold into hall hero cabinets (or restyle into bezels and mount inside hero). Do not keep a second identical grid lower on the page. |
| `components/landing/cabinet-preview.tsx` | **New** — one cabinet (marquee, CSS screen, tags, best score) |
| `components/landing/tournament-banner.tsx` | Copy + pot empty-state + 60/20/20 labeled |
| `components/landing/featured-puzzle.tsx` | `id="puzzle"`, quieter kicker |
| `components/landing/money-flow.tsx` | **New** |
| `components/landing/ownership-section.tsx` | Shorten copy |
| `components/landing/fairness-section.tsx` | **New** |
| `components/landing/footer.tsx` | Rebrand |
| `components/landing/live-stats.tsx` | Unmount |
| `components/landing/activity-feed.tsx` | Unmount |
| `components/landing/how-it-works.tsx` | Unmount |
| `components/landing/split-donut.tsx` | Only if parameterized; else unused |
| `components/landing/particle-background.tsx` | Keep, lower visual weight if it fights cabinets |
| Game canvases under `components/games/` | **Do not import on `/`** |

Do not modify `I-Market/`. Do not change game physics, puzzle answers, or contracts for this task.

---

## 16. Interaction and a11y

- Whole cabinet is a `<Link>` to the game route
- Keyboard: focus ring on bezel (amber/cyan), Enter activates
- Reduced motion: no particle loop, no hover lift, CSS posters static
- Prefers-reduced-motion: skip `ParticleBackground` animation (draw nothing or a static gradient)
- Do not autoplay loud WebAudio from hall previews
- Overlay/click-through bug in the games must **not** be reintroduced on `/` because games are not mounted here

---

## 17. Empty-state policy (hard rule)

If a number is not wired to real data, **do not put a dash**.

| Data | v1 treatment |
|---|---|
| Tournament pot | Sentence: pot goes live with paid entries |
| Players today | Omit |
| Activity feed | Omit |
| NFT marketplace | Disabled “Coming soon” |
| Personal best | Show only if `localStorage` has a value |
| League live? | Puzzle card may say free today |

Fake liveness reads as a casino scam site. This product’s whole pitch is honesty about USDC.

---

## 18. Copy deck (paste-ready)

**Header badge:** `Arc Testnet`

**Hero kicker:** `Skill arcade · USDC on Arc · Free practice`

**Hero h1:** `Play for skill. Settle in USDC.`

**Hero p:** `Walk the hall. Same seeded board for every player. Practice free — or put 1 USDC on tonight’s tournament. Best score at midnight UTC wins.`

**CTA 1:** `Play free`

**CTA 2:** `Today’s puzzle`

**Hall label:** `The hall`

**Hall meta:** `Enter a cabinet to practice`

**Cabinet tags:** `Free practice` · `Tonight · 1 USDC` (host only)

**Tonight kicker:** `Tonight`

**Tonight h2:** `Stack Royale`

**Tonight p:** `Pay 1 USDC. Play for your best score. Highest score when the clock hits 00:00 UTC takes 60% of the pot.`

**Tonight CTA:** `Practice the board`

**Pot empty:** `Pot goes live with paid entries`

**Split caption:** `Tonight’s split · 60% winner · 20% team · 20% NFT holders`

**Puzzle kicker:** `Today’s puzzle`

**Puzzle CTA:** `Play today →`

**Money h2:** `Every dollar in was paid by a player.`

**Money sub:** `No game token. No emissions. USDC on Arc, split on-chain.`

**Own h2:** `Own the machine people play.`

**Fair 01–03:** see §11

**Footer tagline:** `Play · Compete · Own the hall — settled in USDC on Arc.`

---

## 19. Acceptance criteria

The page is done when all of these are true:

1. No occurrence of “Casino” or 🎰 on `/`, header, footer, or metadata.
2. First screen shows **four cabinets** with game-like screens (not four giant emojis as the only art).
3. Primary CTA is **Play free** (no wallet required) and lands on a real game.
4. Secondary CTA lands on `/play` and today’s puzzle title matches `getDailyPuzzle(dateKey())`.
5. Tournament split labeled **60/20/20**. Puzzle league **60/25/15** is not presented as the tournament split.
6. No `—` stats, no fake activity rows.
7. NFT block is below money, with marketplace disabled.
8. How-it-works does not begin with connecting a wallet.
9. `npm run build` in `games/web` succeeds.
10. Existing game routes still work: `/games/stack-tower`, `/games/brick-blitz`, `/games/bubble-pop`, `/games/pinball`, `/play`.

---

## 20. Implementation order for the coding agent

1. Rebrand header, footer, metadata (Casino → Arcade).
2. Build `cabinet-preview.tsx` + CSS posters; put four of them in a new `HallHero`.
3. Rewire `app/page.tsx` section order; unmount stats/feed/how-it-works/donut pair.
4. Restyle tournament (empty pot + 60/20/20 caption) and puzzle (`id="puzzle"`).
5. Add `MoneyFlow` and `FairnessSection`; shorten ownership.
6. Client-only personal bests on cabinets.
7. Reduced-motion pass on particles.
8. Visual check at `http://localhost:3000/` (desktop + narrow mobile snap-scroll).
9. `npm run build`.

Do not wait for videos, NFT marketplace, or live pots. v1 is a **hall you can walk**, not a dashboard of zeros.

---

## 21. Out of scope (do not sneak in)

- New game physics or pinball table changes
- Wiring live pots / holder claims
- Account page
- I-Market marketplace (`I-Market/`)
- Replacing Geist fonts
- Mounting full game canvases on `/`
- Inventing a new token or changing 0.10 / 1.00 / 50% / 60-20-20

---

## 22. Product facts the landing must not contradict

From the business plan + current code:

- Per-round fee **0.10 USDC**, **50% to NFT holders**, remaining share **TBD**
- Daily tournament **1 USDC**, **60 / 20 / 20**, cutoff **UTC midnight**
- Puzzle leagues **0.10 / 0.50 / 1.00**, split **60 / 25 / 15**
- Free practice is unlimited and not tournament-eligible until they pay
- Boards are **date-seeded** so the tournament is fair
- Best scores already live in `localStorage` keys `imarket:<game>:best`
- Puzzle answers are **server-side only** (`lib/puzzles/engine.ts`)
- Chain: Arc testnet, chain id **5042002**
- Game routes already exist and say “Arcade Hall” on the back link — the homepage must deserve that name
