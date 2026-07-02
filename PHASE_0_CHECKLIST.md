# PHASE_0_CHECKLIST.md — SOOTH

> Complete EVERYTHING here before writing a single line of project code. Target: 2–3 hours.

## 1. Accounts & registrations

- [ ] DoraHacks: registered as hacker on https://dorahacks.io/hackathon/casper-agentic-buildathon/detail
- [ ] Post an early BUIDL stub TODAY (name, one-liner, concept, "in active build") — editable later, starts banking CSPR.fans votes
- [ ] CSPR.fans account connected: https://cspr.fans
- [ ] Join Casper Discord (https://discord.com/invite/caspernetwork) — find the buildathon channel, note where office-hours questions go
- [ ] CSPR.cloud account + **API key**: https://console.cspr.cloud (needed for REST/Streaming + x402 facilitator access; buildathon teams get sponsored x402 usage — ask in Discord how the sponsorship is applied)
- [ ] Anthropic API key funded (for the "vibes" LLM trader)
- [ ] Vercel account ready

## 2. Wallets & keys (5 keypairs)

- [ ] Install casper-client OR use casper-js-sdk keygen. Generate ed25519 keypairs into `/keys/`:
  - `deployer.pem` — deploys contracts, seeds liquidity
  - `momo.pem` — momentum trader agent
  - `meanie.pem` — mean-reversion trader agent
  - `vibes.pem` — LLM trader agent
  - `resolver.pem` — resolution agent (this key is the ONLY one authorized to resolve)
- [ ] Faucet CSPR to ALL five at https://testnet.cspr.live/tools/faucet (request the max; re-request if deploys run dry — contract deploys cost real testnet gas)
- [ ] `/keys/` in `.gitignore` BEFORE first commit

## 3. Toolchain

- [ ] Rust stable + `rustup target add wasm32-unknown-unknown`
- [ ] `cargo install cargo-odra` then `cargo odra new --name sooth-contracts -t blank` compiles hello-world clean
- [ ] Node 20+, pnpm
- [ ] casper-js-sdk installed in the services workspace
- [ ] git configured: `git config user.name` / `user.email` set to Nerom's identity. Verify no AI co-author templates. FIRST commit is Nerom's.

## 4. Docs to skim (30–45 min, in this order)

- [ ] Odra flipper + CEP-18 module docs: https://odra.dev/docs/ (feed https://odra.dev/llms.txt to Claude Code at session start)
- [ ] x402 user guide: https://github.com/make-software/casper-x402/blob/master/docs/user-guide.md — clone the repo, run the example server + client locally against testnet ONCE before integrating
- [ ] x402 Facilitator API reference: https://docs.cspr.cloud/x402-facilitator-api/reference
- [ ] CSPR.cloud REST quickstart: https://docs.cspr.cloud
- [ ] CSPR.click AI agent skill (frontend wallet, Phase 4): https://docs.cspr.click/documentation/ai-agent-skills
- [ ] Skim casper deploy lifecycle in https://docs.casper.network/ (concepts → transactions) so error messages make sense

## 5. Repo scaffold

- [ ] GitHub repo `sooth` (public) under github.com/neromtoobad
- [ ] Monorepo layout:
```
sooth/
  contracts/        # cargo odra workspace
  services/
    feed/           # x402-gated data endpoint
    oracle/         # x402-gated probability endpoint
  agents/           # momo, meanie, vibes, resolver, consumer
  web/              # next.js dashboard
  lib/              # shared TS client (sooth.ts)
  keys/             # gitignored
  CLAUDE.md  PHASE_0_CHECKLIST.md  BUILD_GUIDE.md  EXECUTION_PLAN.md
```
- [ ] Copy the four MD docs into repo root
- [ ] First commit: `init: scaffold + docs` (by Nerom, no AI attribution)

## 6. Risk parameters (locked now, not mid-build)

- Demo markets: **deterministic crypto closes only** (e.g. BTC/USD above threshold at fixed UTC time via CoinGecko/Coinbase API)
- One short-horizon market (resolves within hours) for the end-to-end video take; one July 6 market for live drama
- House liquidity seed per market: fixed amount of sUSD from deployer, disclosed in README as bootstrap
- Agent trade cap per cycle + minimum interval — no runaway loops burning faucet gas
- x402 prices: feed = 0.5 CSPR/call, oracle = 1 CSPR/call (cheap enough to demo dozens of calls)

## 7. Go/no-go gate

Phase 0 is DONE when: hello-world Odra contract compiles, x402 example runs end-to-end locally, all five keys are funded on testnet, early BUIDL stub is live on DoraHacks. Then open BUILD_GUIDE.md.
