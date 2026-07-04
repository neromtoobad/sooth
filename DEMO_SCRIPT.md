# SOOTH — 3-minute demo script

Target: **3:00**. Casper Agentic Buildathon 2026. Judges: Casper Association.
Tagline to land twice: **"truth, priced live."**

**Golden rule (from our own playbook):** do NOT let the demo depend on live
compilation or live LLM latency. Start the agents + services 20 min before
recording so the dashboard is warm and the feed is scrolling. Pre-record the
terminal takes; screen-record the dashboard separately; cut together. Have a
fallback take of every on-chain action already confirmed on the explorer.

---

## Pre-flight (before you hit record)

```bash
pnpm feed        # x402 data endpoint, warm
pnpm oracle      # x402 oracle endpoint, warm
pnpm agents      # traders trading — let the feed build ~20 min of history
pnpm dev         # dashboard at localhost:3000, hard-refresh once
```

Open in tabs: dashboard (Markets), a terminal, `testnet.cspr.live` with the
probe-market resolution tx already loaded.

---

## Shot list

### 0:00–0:20 — Cold open (dashboard, Markets page)
**On screen:** the app-shell dashboard. Left rail, `TRUTH, priced LIVE.`
headline, the live probability card ticking, the stat strip, market cards with
their sparklines moving.
**VO:** "This is SOOTH. Prediction markets on Casper where the traders are
autonomous AI agents — and the market's price is sold back to other agents as a
truth signal. Everything you're about to see is a real transaction on testnet."

### 0:20–0:35 — The problem
**On screen:** slow zoom on a market card; briefly flash the Oracle page
"Why a market beats a signature" panel.
**VO:** "Agents need trustworthy real-world data. Every other oracle *attests*
truth — trust my signature. But a signature can only vouch for something that
already has a source. SOOTH prices the truth that has none."

### 0:35–1:15 — x402 in: agents pay for data, then trade
**On screen:** split — terminal (agents) + dashboard. Show a `402 → payment →
200` in the feed logs, then the probability line on a card moving as trades land.
Point at the `x402 micropayments` stat incrementing.
**VO:** "Watch the loop. An agent hits our data endpoint, gets a 402 — payment
required — pays a micropayment over x402, and gets the price. Then it trades its
belief on-chain. Momentum bots, mean-reverters, and LLM agents with opposing
personalities — every buy moves the probability. Wrong beliefs fund right ones."
**Cut to:** Agents page leaderboard for 3 seconds — "the leaderboard is the
thesis, proven."

### 1:15–1:45 — x402 out: the price IS the product
**On screen:** Oracle page. Run the curl in the terminal:
`curl …/oracle/<market>` → `402` → pay → `200 { "p_yes": 0.71 }`.
**VO:** "Now the second use of x402. A consumer agent pays to *read* the
probability — 0.71 YES — and acts on it. Data fees in, oracle fees out. The
oracle funds itself. That's a self-funding truth machine, and x402 is doing the
work on both sides."

### 1:45–2:15 — Unsignable truth + resolution
**On screen:** a `subjective` / "Unsignable" market card, then the Agents-page
jury panel (five jurors, votes, verdict), then the resolver line in the feed.
**VO:** "Some questions no data source can answer — is this claim true, will
this happen. For those, an LLM jury researches and votes, and the settlement
itself is a staked on-chain commit-reveal: agents put sUSD behind the outcome,
the majority wins, the wrong side is slashed. No trusted signer anywhere."

### 2:15–2:40 — Proof on-chain
**On screen:** `testnet.cspr.live` — the probe market's resolution tx
(`8a367cf9…`), then the contract package pages. Scroll the deployments.
**VO:** "This isn't a mockup. Odra contracts on Casper testnet — a binary CPMM,
a market factory, a staked-resolution contract. Markets created on-chain by the
factory, trades, a full resolve-and-payout lifecycle. Here's the receipt."

### 2:40–3:00 — Close
**On screen:** back to the dashboard hero, `TRUTH, priced LIVE.`
**VO:** "125 teams taught agents to spend on Casper. SOOTH teaches the market to
speak — and agents to listen. Odra, x402 twice, CSPR.cloud, a market that prices
what no signature can. Truth, priced live."

---

## The single sentence, if you only get one line in

> "Attestation oracles say *trust my signature.* SOOTH prices truth with skin in
> the game — the one signal you can't fake without losing money."

## What to show on screen, ranked (if you're tight on time, cut from the bottom)
1. The dashboard live + probability moving (the hook)
2. x402 402→pay→200, both directions (the double-integration is the depth story)
3. The on-chain explorer receipt (proves it's real)
4. The jury + staked resolution (the moat)
5. The leaderboard (the "agents have skin in the game" payoff)
