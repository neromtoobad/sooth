# BUILD_GUIDE.md — SOOTH

> Day-by-day plan. Today = July 1. Deadline = July 7, 23:59 UTC. Submit target = July 6 evening (24h buffer). One step at a time. Commit after every phase. If a step exceeds its time box, take the fallback and move on.

---

## DAY 1 (July 1) — Phase 0 + Phase 1 start

**Morning:** run PHASE_0_CHECKLIST.md top to bottom. Post the early BUIDL stub.
**Afternoon/night:** contracts.

- Step 1.1 — sUSD token: Odra CEP-18 module wrapper with open `mint()` (demo faucet token). Success: `cargo odra test` green on transfer + mint.
- Step 1.2 — BinaryMarket contract: constructor(question, close_ts, resolver, susd_address); `add_liquidity`, `buy_yes/buy_no` (CPMM, fee 1%), `sell_yes/sell_no`, `price_yes()` view, `resolve(outcome)` (resolver-only, after close), `claim()`. Fixed-point u64/u128 math, saturating ops.
  - Fallback if sell-side math fights back: ship buy-only + claim. Buys alone move price — demo unaffected.
- Step 1.3 — MarketFactory: `create_market(...)` deploys/initializes markets, stores registry list, emits event. Success: factory test creates 2 markets, trades on both.

**End of day gate:** full odra test suite green. Commit `feat: sooth contracts v1`.

## DAY 2 (July 2) — Phase 2: testnet + client lib

- Step 2.1 — `cargo odra build`, deploy sUSD + factory to testnet (deployer key). Record ALL hashes in `deployments.json` AND README.
- Step 2.2 — create 2 markets via factory on testnet. Verify contracts + txs visible on https://testnet.cspr.live — screenshot for README.
- Step 2.3 — `lib/sooth.ts`: casper-js-sdk client wrapping mint, approve, buy, sell, price read (via CSPR.cloud REST state queries), resolve, claim. Success: a script trades on testnet and the price moves.
  - Fallback if state-read via cspr.cloud is fiddly: read via casper-js-sdk node queries directly; cache in a tiny sqlite for the dashboard.

**Gate:** one scripted end-to-end trade on testnet with explorer receipt. Commit.

## DAY 3 (July 3) — Phase 3: x402 feed + first agents

- Step 3.1 — `services/feed`: Express endpoint `/feed/btc` returning spot + 24h series (CoinGecko proxy), gated by x402 per the make-software examples + facilitator (https://docs.cspr.cloud/x402-facilitator-api/reference). Success: curl without payment → 402; agent client with payment → 200 + on-chain settlement reference.
  - Fallback if facilitator integration stalls > half a day: implement the x402 handshake verifying signed payment against a direct testnet transfer (protocol-faithful, self-verified) and note it in README; swap facilitator in later. DO NOT let this block agents.
- Step 3.2 — momo (momentum) + meanie (mean-reversion) agents: loop = pay x402 → fetch feed → compute signal → trade via sooth.ts → log decision + tx hash. Trade caps from Phase 0 risk params.
- Step 3.3 — resolver agent: at close_ts, fetch deterministic price, call `resolve()`, then trigger claims. Run one full lifecycle on a 1-hour market TODAY.

**Gate:** two agents trading autonomously, one market resolved end-to-end, all on testnet. This is qualification-grade already. Commit + update BUIDL page with tx hashes.

## DAY 4 (July 4) — Phase 4: oracle product + vibes + dashboard

- Step 4.1 — `services/oracle`: x402-gated `GET /oracle/:market` → `{ p_yes, pool_state, block_height, market_hash }`. This is the product. Same x402 pattern as feed.
- Step 4.2 — consumer agent: pays x402, reads probability, logs a decision ("hedging", "approving shipment") — proves the oracle-as-a-service loop.
- Step 4.3 — vibes agent: Claude API reasons over headlines + feed → position + one-line thesis (thesis shown on dashboard — great demo texture). Cap its spend.
- Step 4.4 — dashboard (Next.js, Vercel): market cards, live probability chart (poll price), agent activity feed with thesis lines + explorer links, "buy this feed" panel showing the x402 curl. CSPR.click wallet connect so a human can trade too.
  - Fallback: cut human trading, keep read-only dashboard. Agents are the story.

**Gate:** full loop demoable in one screen + one terminal. Commit. Push a dashboard-screenshot vote post on X.

## DAY 5 (July 5) — Phase 5: polish + video

- Step 5.1 — README: problem → loop diagram → contract addresses + tx receipts → x402 double-integration → stack links (Odra, x402, CSPR.cloud, CSPR.click, docs.casper.network) → run instructions → roadmap (RWA outcome feeds, reputation-weighted resolution, mainnet).
- Step 5.2 — repo cleanup: no keys, no dead code, human commit history, MIT license.
- Step 5.3 — demo video (3 min) per CLAUDE.md demo plan. Record terminal takes FIRST (they flake), dashboard second, voiceover last. Upload YouTube unlisted→public.
- Step 5.4 — 4 pitch slides (problem / loop / on-chain proof / roadmap) exported as PDF in repo.

## DAY 6 (July 6) — SUBMIT + vote push

- Final BUIDL update on DoraHacks: video, repo, live dashboard URL, tx hashes, track = Agentic AI (add DeFi if multi-track allowed).
- X thread in Moren voice: the gap (125 builds, zero prediction markets), the loop, the receipts, cspr.fans vote link. Pin it.
- Ask 3 questions in Casper Discord early enough to fix anything reviewers flag.

## DAY 7 (July 7) — buffer only

Nothing new ships today. Hotfixes + vote replies only.

---

## Stuck protocol (any step)

1. 30 min self-debug max → 2. re-read the exact doc page for that tool → 3. ask Claude Code with full error + file context → 4. 2 hours total → take the step's fallback → 5. log the cut in README "trade-offs" (judges respect honest scoping).
