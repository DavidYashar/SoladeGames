# PuzzleLeague — I-market Games league escrow

Arc-native daily skill-game league escrow. Entries in USDC ERC-20.
Split on settle: **60% winners · 25% NFT holder pool · 15% platform**.

- Tiers: 0 = Copper (0.10 USDC) · 1 = Silver (0.50 USDC) · 2 = Gold (1.00 USDC)
- One entry per address per day+tier
- Owner (game server) settles with the verified winner list
- Winners pull their share with `claim()`

## Test

```powershell
forge test -vv
```

## Deploy to Arc Testnet

```powershell
forge script script/Deploy.s.sol `
  --rpc-url https://rpc.testnet.arc.io `
  --private-key $PRIVATE_KEY `
  --broadcast `
  --sig "run(address,address,address)" `
  0x3600000000000000000000000000000000000000 `
  <HOLDER_POOL> `
  <PLATFORM_FEE>
```

Then set `NEXT_PUBLIC_LEAGUE_ADDRESS` in `../web/.env.local` and restart the dev server.
Players need USDC — mint via the Circle Console faucet (Arc Testnet).

## Daily operations (from `../web/`)

```powershell
# See what a settle would do
node scripts/settle-league.mjs 2026-08-29 0

# Execute it (requires owner PRIVATE_KEY + LEAGUE_ADDRESS env)
node scripts/settle-league.mjs 2026-08-29 0 --execute
```

## Local E2E (anvil)

See `../web/scripts/e2e-league-test.mjs` header for the full flow.
