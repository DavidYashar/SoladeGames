> Historical planning document. Kept for reference; the current direction is the
> [README](../../README.md).

# ARC-ADE: Arcade Economy and NFT Game Theory Plan

> Strategy document for the ARC-ADE testnet season, whitelist campaign, paid tournaments, and game-related NFT collection.
>


## 1. Executive recommendation

The strongest version of the idea is:

> Players practice and compete across four fair, deterministic games. Their verified season performance earns points. The top 1,000 eligible wallets receive mint whitelist access. The NFT represents a machine in the arcade and unlocks identity, progression, access, and possible distributions tied to real game activity.

This is stronger than selling an NFT first and trying to create utility later.

The three product phases should be separate:

1. **Testnet season:** free gameplay, verified points, rankings, and whitelist qualification.
2. **NFT mint:** qualified players mint game-related machine NFTs.
3. **Live tournaments:** players enter skill competitions with USDC, while prize pools, NFT holders, and the platform receive published shares.

The project should remain positioned as a skill arcade, not a casino or speculative play-to-earn token system.

## 2. Proposed product model

### 2.1 Testnet season

Players use the four current games:

- Stack Tower
- Brick Blitz
- Bubble Pop
- Neon Pinball
- (games can be changed, added or enhanced in quality or quantity over time)

Each game uses deterministic or date-seeded mechanics. The current game implementation already has game-specific seeds and local personal-best storage. For a real whitelist campaign, scores are not trusted from the browser: a signed score submission is validated and then recorded on-chain. **The Smart Contract on ARC chain is the authoritative ledger for all points, scores, and season data** — not the client.

Players earn a capped season score. At the end of the season:

- Take a published snapshot.
- Rank eligible wallets.
- Give the top 1,000 wallets guaranteed whitelist access.
- Give ranks 1,001 through 1,500 reserve-list access.
- Allow one mint per eligible wallet unless a later rule is explicitly announced.

The reserve list prevents unused supply if some winners do not mint.

### 2.2 NFT collection

The collection should contain four machine identities related to the four games:

| Machine type | Related game |
|---|---|
| Tower Machine | Stack Tower |
| Brick Machine | Brick Blitz |
| Bubble Machine | Bubble Pop |
| Pinball Machine | Neon Pinball |

Each NFT can contain:

- Machine type
- Token number
- Season earned
- Founder or testnet provenance
- Visual traits related to the game
- Machine level
- Usage history
- Cosmetic rarity

The narrative is:

> You earned a machine by helping build the arcade. The machine becomes more useful and more interesting as the arcade is used, and earn through the tournament rewards, and the XP you collected over time, on your NFT.



### 2.3 Paid tournaments

A player pays a small USDC entry fee, plays the selected game under defined rules, and competes on a verified leaderboard.

The proposed gross split is:

```text
60% to the prize pool
25% to eligible NFT holders
15% to the platform
```

This is a clean model, but the 60% prize pool should normally be distributed across multiple ranks rather than paid entirely to one player(first to third for instance).

A possible prize distribution inside the 60% prize pool:

| Rank | Share of prize pool |
|---|---:|
| 1st | 50% |
| 2nd | 25% |
| 3rd | 15% |

(this can be discussed)

The exact distribution is a product decision. It should be published before the first paid tournament and encoded in the contract or settlement service.

## 3. Whitelist scoring

### 3.1 We do not use raw lifetime points

A raw total score creates several problems:

- Players with more free time beat more skilled players.
- One player can split activity across many wallets.
- One game may be easier to farm than another.
- Repeated play can inflate activity without proving skill.
- Browser-local scores can be manipulated.

The whitelist should use a capped, normalized season score instead.

### 3.2 Recommended season-score formula

```text
Season Score =
  Verified Skill Score
+ Game Diversity Bonus
+ Tournament Participation
+ Improvement and Consistency
- Abuse Penalties
```

Suggested weighting:

| Component | Weight |
|---|---:|
| Verified skill performance | 60% |
| Playing multiple games | 15% |
| Tournament participation and placement | 15% |
| Improvement and consistency | 10% |

These percentages are starting points, not immutable rules.

### 3.3 Normalized skill score

Each game has its own normalized score from 0 to 1,000. Raw scores are never compared across games.

A **concrete, published formula** is required so that any two people can reproduce the same number. The recommended shape is a percentile-style mapping, seeded with fixed reference scores so early-season values stay stable:

```text
normalized = 1000 * clamp( (playerScore - min) / (max - min), 0, 1 )
```

- `min` / `max` are published per game and updated at most once a season.
- Seed them with fixed testnet reference scores, so a weak day never drifts a floor toward zero.
- This is the single most important fairness surface; publish the exact numbers before the season snapshot.

Per-game normalization signals:

- Stack Tower: height reached, perfect-drop rate, and combo/streak
- Brick Blitz: wave reached, bricks destroyed, and lives remaining
- Bubble Pop: bubbles cleared, shot efficiency, and chain/combo
- Neon Pinball: score under fixed ball/lives/table rules

The final skill score is the average of a player's best verified performance across games, subject to a **minimum game-count requirement**. A player cannot qualify through one game alone — at least 2–3 games must meet a minimum score threshold (enforced by smart contract, on testnet before mint).

### 3.4 Daily caps

Use caps to make the leaderboard skill-oriented rather than time-oriented.

Example:

```text
Maximum qualifying points per game per day: 1,000
Maximum qualifying points across all games per day: 3,000
```

Players can continue to practice after reaching the cap, but extra play should not keep increasing whitelist rank indefinitely.

### 3.5 Game diversity bonus

Reward players who understand the full arcade:

| Participation | Example bonus |
|---|---:|
| One game | 0 |
| Two games | +100 |
| Three games | +250 |
| Four games | +500 |

The bonus should be capped and should not outweigh actual skill.

### 3.6 Consistency and improvement

Give limited points for:

- Playing on multiple separate days
- Improving a verified personal best
- Maintaining a daily puzzle streak
- Returning during different season weeks

These components are deliberately small (≈10%) and **must never outweigh skill**. The ranking is driven by capped, best verified performance — not by presence, frequency, or grind.

- Only the **best verified performance per game per day** counts toward the skill score.
- Frequency rewards are capped and never compound indefinitely.
- No points for repeated low-quality play; repetition beyond the daily cap does not raise rank.

The objective is to build a habit, not to create a click farm.



## 4. Make tournaments more challenging

The basic tournament loop is good, but one score and one winner can become repetitive. The following mechanics add depth without introducing gambling-style randomness.

### 4.1 Daily seeded challenge

Keep the same seed for everyone:

- Same board
- Same starting conditions
- Same game version
- Same scoring rules
- Same official attempt limit

Free practice can remain unlimited, but only an official paid attempt should count toward the competitive leaderboard.

### 4.2 Qualifier and final

We use a two-stage event for special tournaments:

```text
Practice -> Qualifier -> Top 16 final -> Winner
```

For example:

- Entry fee: 0.10 USDC
- One qualifying run
- Top 16 advance
- Final uses a second shared seed
- Final winner determined by score

This creates a meaningful event while preserving skill-based fairness.

(we can discuss about this)


### 4.3 Challenge modes

Create separate competitive modes for experienced players:

- Speed mode
- One-life mode
- Precision mode
- Hard seed
- No-power-up mode
- Limited-time challenge

Each mode should have its own leaderboard and published scoring rules.

### 4.4 Weekly Grand Prix

Daily tournaments create habit. Weekly championships create status.

Possible structure:

- Players earn qualifying points during the week.
- Top 64 enter the Sunday event.
- Players compete in all four games.
- The combined score determines the champion.
- The winner receives the main prize and a permanent season badge.

This encourages players to engage with the complete collection.

### 4.5 Game rotation

Rotate the featured game rather than letting Stack Tower host every event:

```text
Monday: Stack Tower
Tuesday: Brick Blitz
Wednesday: Bubble Pop
Thursday: Neon Pinball
Friday: mixed challenge
Weekend: Grand Prix
```
(can be changed, or use off chain randomization for this. open to discussion)
## 5. NFT game theory

### 5.1 Four machine identities

Each NFT type can represent a different play style:

| Machine | Identity |
|---|---|
| Tower | Precision and timing |
| Brick | Waves, survival, and power-ups |
| Bubble | Efficiency and chain reactions |
| Pinball | Momentum, physics, and combo mastery |

NFT utility should primarily affect access, identity, cosmetics, progression, and prestige. It should never make the owner directly unbeatable in a paid competition, and no NFT benefit should be required to win.

A machine NFT is primarily a **revenue-share and identity asset, not a competitive advantage**. The 25% holder pool is a share of eligible game revenue, not a reward for skill or activity — holding a machine does not make its owner a better tournament player. Holder distributions must not be activated until competitive integrity has been proven in free tournaments (Stage D must precede Stage F).

### 5.2 Collection completion bonus

Holding one machine from each category can unlock:

- Founder or collector badge
- Cross-game tournament access
- Special weekly challenge
- Full arcade cabinet theme
- Limited cosmetic set
- Voting access for future game themes



### 5.3 Machine levels

Machine XP needs a clear owner and attribution rule. Possible models:

1. The machine earns XP when its owner plays. (ERC6551 token-bound account model)
2. The machine earns XP whenever anyone plays its game.
3. The owner assigns the machine to one game for a season.
4. The NFT level is based on the historical usage of its game.

Recommended model:

> An owner assigns a machine to one game for a season. The machine earns XP and benefits from that game's activity. The assignment has a cooldown or season lock.

This creates a meaningful choice without allowing constant switching.


### 5.4 Commitment and lock periods

A possible later mechanic is machine commitment:

| Lock period | Example share weight |
|---|---:|
| No lock | 1.00x |
| 30 days | 1.10x |
| 90 days | 1.25x |
| 180 days | 1.50x |

This creates a choice between liquidity and commitment. It must be reviewed legally and economically before launch and must never be described as guaranteed yield.



### 6.1 Proposed arcade tournament split

```text
60% prize pool
25% NFT holder pool
15% platform
```

### 6.2 Proposed paid arcade round split

For the existing planned 0.10 USDC paid round:

```text
0.10 USDC per round
25% NFT holders
60% prize reserve or tournament funding
15% platform
```



## 7. Recommended launch sequence

### Stage A: Testnet foundation

-- Ensure testnet environment mirrors mainnet as closely as possible.
-- Validate all smart contract interactions on testnet before mainnet deployment.
-- Receive feedback from users and iterate on the testnet experience.

### Stage B: Testnet leaderboard

- Build the verified score ledger (on-chain smart contract authoritative records).
- Calculate normalized scores from the published per-game formula.
- Publish the full leaderboard methodology (normalization formula, caps, tie-break).
- Add reserve list.
- Run at least one dry-run snapshot.
- Test score disputes and corrections.

### Stage C: NFT mint

- Deploy audited NFT contract. (preferably using opensea and launchpad)
- The minted NFT ID gets synced to its counter ERC-6551 account.


### Stage D: Paid tournaments

- Deployed arcade tournament contract.(synced with NFT contract, and the erc-6551 accounts)
- Implement the 60/25/15 split.
- Add multi-rank prizes.
- Add eligibility and geographic controls.
- Add event monitoring.
- Start with low limits and small entry amounts.


### Tournaments

- 0.10 USDC standard entry
- Same seeded challenge for all players
- One clearly defined official score
- Skill bands
- 60% prize pool
- 25% NFT holders
- 15% platform
- Prize pool distributed across multiple ranks
- Weekly Grand Prix for prestige

### Product philosophy

> Build a fair game first, make ownership meaningful second, and connect distributions only to real activity that can be verified.

That gives ARC-ADE a stronger identity than a generic NFT mint or a casino-style wagering app. It creates a progression from player to competitor to owner, while keeping the economic rules understandable and testable.

