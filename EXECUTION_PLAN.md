# EXECUTION_PLAN.md — SOOTH · prompt-by-prompt for Claude Code

> Paste these into Claude Code in order, one at a time. Wait for each to finish and verify the success criteria before the next. Start every session with the SESSION prompt.

---

## SESSION PROMPT (start of every Claude Code session)

```
Read CLAUDE.md, BUILD_GUIDE.md and EXECUTION_PLAN.md in the repo root. We are building SOOTH for the Casper Agentic Buildathon, deadline July 7. Before coding, fetch and read https://odra.dev/llms.txt so you understand the Odra framework's current API. Follow CLAUDE.md's "things not to do" strictly. Never add AI co-author lines or Claude attribution to any commit. Tell me which phase/step we're on based on the checkboxes in CLAUDE.md, then wait for my go.
```

---

## PHASE 0 — SETUP

### P0.1 — scaffold

```
Set up the SOOTH monorepo in the current directory exactly per the layout in PHASE_0_CHECKLIST.md section 5: contracts/ (leave empty for now), services/feed, services/oracle, agents/, web/, lib/, keys/ (gitignored). Initialize git, set git user.name to "neromtoobad" and user.email to my GitHub email (ask me for it), add a .gitignore covering keys/, node_modules, target/, .env*. Create a root package.json with pnpm workspaces for services, agents, web, lib. Do NOT commit yet — show me the tree first.
```

### P0.2 — toolchain + keys

```
Verify rust stable, wasm32-unknown-unknown target, and cargo-odra are installed; install anything missing and show versions. Then scaffold contracts/ with `cargo odra new --name sooth-contracts -t blank` and confirm it compiles with `cargo odra test`. Next, write scripts/keygen.ts using casper-js-sdk that generates five ed25519 keypairs (deployer, momo, meanie, vibes, resolver) into keys/ as .pem plus a keys/accounts.json with their public keys and account hashes. Run it and print the five public keys so I can faucet them at https://testnet.cspr.live/tools/faucet.
```

### P0.3 — x402 dry run

```
Clone https://github.com/make-software/casper-x402 into a sibling folder (not inside our repo). Read docs/user-guide.md and the examples folder. Run the example x402 server and client locally against Casper testnet using the deployer key, with the facilitator per https://docs.cspr.cloud/x402-facilitator-api/reference (I'll paste my CSPR.cloud API key into .env, never hardcode it). Walk me through what happened: the 402 response, the payment header, the settlement. Then write a one-page NOTES_X402.md in repo root summarizing exactly how we'll wire this into services/feed and services/oracle, including which package/middleware we import.
```

---

## PHASE 1 — CONTRACTS

### P1.1 — sUSD token

```
In contracts/, using Odra's CEP-18 module (check https://odra.dev/llms.txt and Odra docs for the current module path), implement sUSD: name "Sooth USD", symbol sUSD, 9 decimals, and a public mint(to, amount) with no access control — it is a demo faucet token, comment that clearly. Write Odra tests: mint, transfer, approve/transfer_from. Run `cargo odra test` until green. Show me the final token source and test output.
```

### P1.2 — BinaryMarket

```
Implement BinaryMarket in contracts/ as an Odra module. State: question (String), close_ts (u64), resolver (Address), susd (Address of CEP-18), reserves yes_pool/no_pool (U256), lp seed tracking, resolved (Option<bool>), user share balances for YES and NO. Entry points:
- init(question, close_ts, resolver, susd)
- add_liquidity(amount): pulls sUSD via transfer_from, splits into equal yes/no reserves (deployer-only is fine)
- buy_yes(amount_in) / buy_no(amount_in): constant-product swap sUSD -> shares with a 1% fee, U256 math, no floats, checked ops, revert on zero output
- sell_yes(shares) / sell_no(shares): inverse swap
- price_yes() view: no_pool / (yes_pool + no_pool) scaled to 1e9 (probability in nano units)
- resolve(outcome: bool): only resolver, only after close_ts, only once
- claim(): after resolution, winning shares redeem 1:1 in sUSD from pool, losing shares are worthless
Emit Odra events for Trade, Resolved, Claimed. Write exhaustive tests: price moves in the right direction on buys, fee accounting, resolve access control (wrong key reverts, before close_ts reverts, double resolve reverts), full lifecycle mint -> liquidity -> trades -> resolve -> claim conserves sUSD within fee tolerance. Run `cargo odra test` until all green. If sell-side math gets messy, STOP and tell me — CLAUDE.md fallback says buy-only is acceptable.
```

### P1.3 — MarketFactory

```
Implement MarketFactory as an Odra module: create_market(question, close_ts, resolver) deploys/initializes a BinaryMarket (use Odra's sub-module/deployer composition pattern — check the docs for the current idiom), stores its address in a Vec, exposes markets() view and market_count(), emits MarketCreated. Test: create two markets, trade on both independently, list them. All tests green, then commit everything as "feat: sooth contracts v1" with me as the sole author.
```

---

## PHASE 2 — TESTNET + CLIENT

### P2.1 — deploy

```
Build wasm with `cargo odra build`. Then deploy to Casper testnet with the deployer key: first sUSD, then MarketFactory (constructor takes sUSD address). Use Odra's livenet backend if it's the smoothest current path, otherwise casper-client put-deploy — pick one, explain why in one paragraph, and script it as scripts/deploy.ts (or a shell script) so it's reproducible. Poll until success, then write deployments.json at repo root with network, contract package hashes, deploy hashes, and timestamps. Give me the testnet.cspr.live links to verify. If gas runs out, tell me how much more faucet CSPR each key needs.
```

### P2.2 — create markets

```
Script scripts/create-markets.ts: via the factory create two markets — (1) "BTC/USD closes above $[ASK ME FOR CURRENT PRICE + 1%] at 2026-07-06 00:00 UTC", close_ts accordingly, resolver = resolver key; (2) a 2-hour market from now on BTC being above its current price, for today's end-to-end lifecycle test. Mint sUSD to all five accounts, approve, add_liquidity to both markets from deployer per the risk params in PHASE_0_CHECKLIST section 6. Print every tx hash with explorer links, append them to deployments.json.
```

### P2.3 — client lib

```
Write lib/sooth.ts, a typed client over casper-js-sdk + CSPR.cloud REST (key from .env): connect(keyPath), mint, approve, buyYes/buyNo/sellYes/sellNo(marketHash, amount), priceYes(marketHash), marketInfo, resolve, claim, and listMarkets() via the factory. Reads should go through CSPR.cloud contract-state endpoints (https://docs.cspr.cloud); if a particular read is painful, fall back to node queries via the SDK and note it. Then write scripts/smoke.ts: momo buys YES on the 2-hour market, print price before/after and the tx link. Run it against testnet and show me the price actually moving. Commit "feat: testnet deploy + ts client".
```

---

## PHASE 3 — FEED + AGENTS

### P3.1 — x402 feed service

```
Build services/feed per NOTES_X402.md: Express server, GET /feed/btc returns { spot, series_24h[], ts } proxied from CoinGecko with 60s cache. Gate it with x402 exactly like the make-software example server, price 0.5 CSPR, settling via the CSPR.cloud facilitator. Also write lib/x402-client.ts that any agent can use to auto-handle 402 -> pay -> retry with its own key. Acceptance: plain curl gets 402; a test script using x402-client with momo's key gets 200 and we can point at the settlement on-chain. If the facilitator fights us for more than a focused session, implement the CLAUDE.md fallback (verify signed payment against a direct testnet transfer) behind the same interface and flag it in README — do not stall.
```

### P3.2 — trader agents

```
Build agents/momo.ts and agents/meanie.ts sharing agents/base.ts. Loop every N seconds (config): pay x402 via x402-client -> fetch /feed/btc -> compute signal (momo: momentum over last hour vs market probability; meanie: fade moves — if price_yes diverged >X% from a naive model, trade toward it) -> size trade within the per-cycle cap from risk params -> execute via lib/sooth.ts -> append { ts, agent, signal, action, txHash, cost } to a shared jsonl log AND stdout. Idempotent, crash-safe, respects min interval. Run both against the 2-hour market for 15 minutes and show me the log with at least 4 trades and the probability moving on-chain.
```

### P3.3 — resolver agent

```
Build agents/resolver.ts: watches markets from the factory; when close_ts passes, fetches BTC/USD from two independent sources (CoinGecko + Coinbase), requires agreement within 0.5%, calls resolve(outcome) with the resolver key, then calls claim() for each agent account holding winning shares. Log every step with tx links. Run the FULL lifecycle on the 2-hour market today: trades -> close -> resolve -> claims. Paste me the complete receipt trail. Then commit "feat: agents + x402 feed, first market resolved e2e" and remind me to update the DoraHacks BUIDL page with these tx hashes.
```

---

## PHASE 4 — ORACLE + VIBES + DASHBOARD

### P4.1 — oracle service

```
Build services/oracle: GET /oracle/:marketHash returns { p_yes, yes_pool, no_pool, block_height, market_hash, question, ts }, reading via lib/sooth.ts. Gate with x402 at 1 CSPR using the identical middleware as feed. This endpoint IS the product — add an OpenAPI-ish README in services/oracle explaining how any external agent consumes market-priced truth. Acceptance: curl -> 402; paid call -> 200 with live probability.
```

### P4.2 — consumer agent

```
Build agents/consumer.ts simulating an external protocol's risk agent: every 2 minutes pays x402, reads /oracle for the July 6 market, and logs a decision rule ("p_yes > 0.7 -> hedge ON, else OFF") with the payment reference. This proves oracle-as-a-service. Run it, show me three cycles of output.
```

### P4.3 — vibes (LLM trader)

```
Build agents/vibes.ts: pays x402 for the feed, additionally pulls 3 crypto headlines (any free RSS/API), then calls the Anthropic API (key from .env, model claude-sonnet-4-6) with a strict JSON-output prompt returning { direction: yes|no|hold, confidence: 0-1, thesis: one sentence }. Trade only if confidence > 0.6, within trade caps. Thesis goes into the shared activity log — the dashboard will display it. Hard cap: max 10 LLM calls/hour. Run one cycle and show me the parsed decision + tx.
```

### P4.4 — dashboard

```
Build web/ as a Next.js + Tailwind app: (1) market cards from listMarkets() with question, live p_yes as a big percentage, close countdown; (2) a probability line chart polling every 10s per market; (3) an agent activity feed streaming the shared jsonl log via a tiny API route — agent name, action, vibes' thesis lines, tx hash linking to testnet.cspr.live; (4) an "consume this oracle" panel showing the literal curl for /oracle with the 402 flow explained; (5) CSPR.click wallet connect per https://docs.cspr.click/documentation/ai-agent-skills letting a human buy YES/NO — if CSPR.click integration exceeds a half day, ship read-only per the fallback. Dark theme, minimal, no purple gradients. Deploy to Vercel and give me the URL. Commit "feat: oracle service + dashboard".
```

---

## PHASE 5 — SHIP

### P5.1 — README + cleanup

```
Write the root README.md: one-line pitch ("truth, priced live — the market-priced oracle for the agent economy"); the problem (attestation oracles vs incentive-priced truth, name the gap: zero prediction-market builds in this buildathon); ASCII architecture from CLAUDE.md; the double x402 loop diagram; deployments table (all contract + tx hashes with explorer links); stack section explicitly crediting Odra, casper-x402 + CSPR.cloud facilitator, CSPR.cloud APIs, CSPR.click, docs.casper.network, casper.network/ai toolkit; quickstart (env vars, pnpm commands, cargo odra test); honest trade-offs section (anything we fell back on); roadmap (RWA outcome feeds, reputation-weighted resolution, subjective markets with dispute windows, mainnet). Then sweep the repo: no keys, no .env, no dead files, no AI attribution anywhere in git history. Show me `git log --format='%an %s'` to verify authorship.
```

### P5.2 — demo assets

```
Write DEMO_SCRIPT.md: a timed 3-minute shot list implementing the demo plan in CLAUDE.md — [0:00] dashboard cold open, [0:20] split terminal: agent hits 402, pays, trades, chart moves, [1:20] consumer agent pays x402 and reads 0.7x, [1:50] resolver take (pre-recorded from Day 3's lifecycle), [2:20] explorer receipts montage, [2:45] closing line: "125 teams taught agents to spend on Casper. SOOTH teaches the market to speak — and agents to listen." Include exact terminal commands per shot and a voiceover script in my lowercase content voice, no hype words. Also generate 4 minimal pitch slides as slides.md (problem / loop / on-chain proof / roadmap) that I'll export.
```

### P5.3 — submission pack

```
Produce SUBMISSION.md containing: the DoraHacks BUIDL description (project overview 2 paragraphs, features list using ➠ bullets, tech stack, all links: repo, video placeholder, Vercel URL, deployments.json highlights), track selection rationale (Agentic AI primary, DeFi secondary), and answers to likely judge questions (how is resolution trustworthy, what stops wash trading, why x402 twice, path to mainnet). Keep every claim backed by a tx hash we actually have.
```

---

## STUCK PROMPT (use whenever blocked)

```
We're stuck on [STEP]. Error/context: [PASTE]. Re-read CLAUDE.md constraints and the relevant official doc (Odra: https://odra.dev/docs/ · x402: https://github.com/make-software/casper-x402/blob/master/docs/user-guide.md · CSPR.cloud: https://docs.cspr.cloud · Casper: https://docs.casper.network). Give me: (1) most likely cause, (2) minimal fix, (3) if this costs >2 hours, the fallback per BUILD_GUIDE and what we log in README trade-offs. Do not redesign the architecture.
```

## COMMIT PROMPT (end of every phase)

```
Stage and commit the completed phase with a short lowercase message describing what shipped, me as sole author, no AI attribution. Then update the checkboxes in CLAUDE.md and tell me the next step ID from EXECUTION_PLAN.md.
```
