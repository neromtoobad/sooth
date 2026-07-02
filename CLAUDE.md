# CLAUDE.md — SOOTH

> Read this file at the start of EVERY session. It is the project brain.

## What SOOTH is

**SOOTH — the market-priced oracle for the agent economy.**
Tagline: *truth, priced live.*

Prediction markets on Casper where autonomous AI agents pay x402 micropayments for data, trade on their beliefs, and the resulting market price is itself sold as an oracle feed to other agents via x402. Attestation oracles say "trust me, I signed it." SOOTH prices truth with skin in the game.

The loop:
1. Trader agents pay x402 → buy market data (our paid data endpoint)
2. Agents trade YES/NO shares on Casper testnet (Odra contracts, real on-chain txs)
3. Market price = live probability = a truth signal
4. Consumer agents pay x402 → read the probability via the SOOTH Oracle API
5. Market resolves on-chain → payouts → agent P&L is public

**Hackathon:** Casper Agentic Buildathon 2026 — Qualification Round (DoraHacks)
**Deadline:** July 7, 2026, 23:59 UTC (extended)
**Qualification:** working prototype on Casper **Testnet** with a **transaction-producing on-chain component** + GitHub repo + demo video. Community voting on CSPR.fans is a parallel fast-track (top 3 by votes).
**Judges:** Casper Association. Their thesis: "Casper is the trust layer for the agent economy."

## Positioning (memorize for pitch)

- 125 submissions. ~20% are attestation/oracle plays (Claros, Verity, ProofNav, CasperGuard, Sasha). They all attest truth. SOOTH **prices** it. Price is the one signal you can't fake without losing money.
- Zero prediction-market entries in the entire field.
- Every judging box is native, not bolted on: agentic (autonomous traders), DeFi (markets/CPMM), x402 used TWICE (data in, oracle reads out), constant on-chain activity (trades, resolutions, payouts).

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      SOOTH DASHBOARD (Next.js, Vercel)       │
│   live probability chart · agent feed · tx explorer links    │
└──────────────┬───────────────────────────────┬───────────────┘
               │ reads (CSPR.cloud REST)       │
┌──────────────▼──────────────┐  ┌─────────────▼──────────────┐
│   CASPER TESTNET (Odra)     │  │      SOOTH SERVICES (Node)  │
│  • MarketFactory            │  │  • /feed  — x402-gated data │
│  • BinaryMarket (CPMM)      │  │    endpoint (BTC/CSPR px)   │
│  • sUSD (CEP-18 demo token) │  │  • /oracle — x402-gated     │
│  • resolve() + payout()     │  │    probability reads        │
└──────────────▲──────────────┘  └─────────────▲──────────────┘
               │ casper-js-sdk txs             │ x402 payments
┌──────────────┴───────────────────────────────┴───────────────┐
│                        AGENTS (Node/TS)                       │
│  momo (momentum) · meanie (mean-revert) · vibes (LLM/Claude)  │
│  + resolver agent (posts outcomes from deterministic API)     │
│  + consumer agent (pays x402, reads oracle, "acts")           │
└───────────────────────────────────────────────────────────────┘
```

## Stack

- **Contracts:** Rust + Odra framework (https://odra.dev/docs/, AI index: https://odra.dev/llms.txt)
- **Token:** sUSD — CEP-18 demo stablecoin via Odra's built-in CEP-18 module (avoids native purse complexity)
- **AMM:** fixed-point binary CPMM (x*y=k over YES/NO share reserves). NO LMSR. Keep it dumb.
- **x402:** official Casper reference impl — https://github.com/make-software/casper-x402 (examples: /tree/master/examples, guide: /blob/master/docs/user-guide.md). Facilitator API: https://docs.cspr.cloud/x402-facilitator-api/reference
- **Chain access:** casper-js-sdk + CSPR.cloud REST/Streaming (https://docs.cspr.cloud, skill: https://cspr.cloud/skill.md)
- **Wallet UI:** CSPR.click (https://docs.cspr.click/documentation/ai-agent-skills)
- **MCP (stretch/demo garnish):** Casper MCP Server — https://github.com/msanlisavas/casper-mcp / https://docs.cspr.cloud/agentic-tools/mcp-server
- **Agents:** Node.js/TypeScript, Anthropic API for the LLM trader ("vibes") + heuristic traders
- **Frontend:** Next.js + Tailwind, deploy Vercel
- **Explorer:** https://testnet.cspr.live

## Phases (check off as completed)

- [x] **Phase 0** — environment, keys, faucet CSPR, repo, docs read — DONE except user-side items: faucet the 5 keys, CSPR.cloud API key in .env, DoraHacks BUIDL stub
- [x] **Phase 1** — Odra contracts: sUSD (CEP-18), BinaryMarket (buy YES/NO via CPMM, resolve, claim), MarketFactory. 12 tests green. Trade-offs: buy-only v1 (sell = stretch); on-chain create_market via codegen factory can't run on OdraVM, gets verified on testnet in Phase 2 (tested register_market fallback in place)
- [ ] **Phase 2** — deploy to Casper testnet, verify on testnet.cspr.live, thin TS client lib (`/lib/sooth.ts`) that can create market, trade, read state
- [ ] **Phase 3** — services: x402-gated `/feed` endpoint; trader agents momo + meanie trading live; resolver agent resolving a short-horizon market end-to-end
- [ ] **Phase 4** — x402-gated `/oracle` endpoint; consumer agent demo; "vibes" LLM trader; dashboard live on Vercel
- [ ] **Phase 5** — README, architecture diagram, demo video (3 min), BUIDL submitted on DoraHacks, CSPR.fans vote push on X

## Commands

```bash
# contracts
cargo odra test                 # run tests against Odra VM
cargo odra test -b casper       # run against casper backend
cargo odra build                # produce wasm
# deploy (casper-client or odra livenet — see BUILD_GUIDE Phase 2)
# services & agents
pnpm dev            # dashboard
pnpm feed           # x402 data endpoint
pnpm oracle         # x402 oracle endpoint
pnpm agents         # start trader agents
pnpm resolver       # resolver agent
```

## Demo plan (3 minutes)

1. Cold open on dashboard: market "BTC closes above $X on July 6" at 52%
2. Terminal split: agents pay x402 for the feed (show 402 → payment → 200), then trade — probability line moves live
3. Consumer agent pays x402, reads "0.78 YES", logs its decision
4. Resolver posts outcome on-chain → payouts land → cut to testnet.cspr.live receipts
5. Close: "125 teams taught agents to spend on Casper. SOOTH teaches the market to speak — and agents to listen. Truth, priced live."

## Pitch script skeleton

- Problem: agents need trustworthy real-world data. Attestation = trust a signature. Markets = trust incentives.
- SOOTH: prediction markets where agents trade, and the price itself is a paid oracle. x402 in, x402 out. Self-funding truth machine.
- Casper-native: Odra contracts, x402 Facilitator, CSPR.cloud, CSPR.click, instant finality = probabilities update at chain speed.
- Roadmap: RWA outcome markets (fx, commodity settlement) as market-resolved data feeds; reputation-weighted resolution; mainnet.

## THINGS THAT BURNED US BEFORE (Delphi Duel lessons — DO NOT REPEAT)

1. **Git identity FIRST.** `git config user.name "neromtoobad"` + email before ANY commit. NEVER allow "Co-Authored-By: Claude" or any AI attribution in commits. Nerom copies code and commits himself where feasible.
2. **Go protocol-deep, not app-shallow.** The CPMM contract, the x402 double-integration, and the resolver design are the depth story. Lead with them, not the UI.
3. **Use the sponsor's whole stack visibly.** x402 + Odra + CSPR.cloud + CSPR.click. Name them in README and video.
4. **Commit after every phase.** Small, human-written commit messages, lowercase, no emoji.

## THINGS NOT TO DO

- No LMSR, no multi-outcome markets, no orderbooks. Binary CPMM only.
- No mainnet. Testnet only.
- No subjective-resolution markets in the demo. Deterministic API-resolvable only (crypto closes). Subjective = roadmap slide.
- No native CSPR purse juggling inside the AMM — sUSD CEP-18 keeps transfers uniform.
- Do not let the demo depend on live compilation or live LLM latency. Pre-record fallback takes.
- Do not spend more than half a day on dashboard polish before Phase 3 works.

## Key links (single source of truth)

- Hackathon: https://dorahacks.io/hackathon/casper-agentic-buildathon/detail
- AI Toolkit hub: https://www.casper.network/ai#toolkit
- Casper docs: https://docs.casper.network/
- Casper GitHub org: https://github.com/casper-network
- Odra docs: https://odra.dev/docs/ · llms.txt: https://odra.dev/llms.txt
- x402 reference: https://github.com/make-software/casper-x402 · user guide: https://github.com/make-software/casper-x402/blob/master/docs/user-guide.md
- x402 Facilitator API: https://docs.cspr.cloud/x402-facilitator-api/reference
- CSPR.cloud docs: https://docs.cspr.cloud · skill: https://cspr.cloud/skill.md
- CSPR.click AI skill: https://docs.cspr.click/documentation/ai-agent-skills
- Casper MCP server: https://github.com/msanlisavas/casper-mcp
- CSPR.trade MCP: https://mcp.cspr.trade/
- casper-eip-712 (stretch, gasless agent signing): https://github.com/casper-ecosystem/casper-eip-712
- Testnet explorer + faucet: https://testnet.cspr.live
- Voting: https://cspr.fans
