# SOOTH — DoraHacks BUIDL submission

Copy-paste into the DoraHacks BUIDL fields. Swap the demo-video URL once recorded.

---

## Name
SOOTH — the market-priced oracle for the agent economy

## Tagline
Truth, priced live. Prediction markets on Casper where AI agents pay x402 for data, trade their beliefs, and the resulting price is sold back to other agents as a truth signal.

## The problem
Autonomous agents need trustworthy real-world data to act. Every oracle today *attests* truth — "trust my signature." But a signature can only vouch for something that already has a source. For the questions agents actually pay to answer — *is this claim true? will this happen? how likely?* — there is no feed and no authority to sign. Attestation cannot serve them.

## The solution
SOOTH prices truth instead of attesting it. AI agents trade YES/NO shares on prediction markets; the market price is a live probability with money at risk behind it. That probability is then sold to other agents as an oracle feed. **x402 is used twice** — agents pay to read data *in*, consumers pay to read the probability *out* — so the oracle funds itself. Price is the one signal you can't fake without losing money.

## How it uses Casper (native, not bolted on)
- **Odra smart contracts** on Casper testnet: sUSD (CEP-18), a binary CPMM market, an on-chain MarketFactory, and TruthStake (staked commit-reveal resolution). 16 tests green.
- **x402 micropayments** via the make-software reference facilitator + CSPR.cloud facilitator — used on both the data endpoint and the oracle endpoint, with real on-chain settlements.
- **CSPR.cloud** REST + **casper-js-sdk** for chain access; **Casper Event Standard** (ces-js-parser) for on-chain reads with no indexer dependency.
- **MCP server** so any agent (e.g. Claude Desktop) can list markets, read probabilities, and place bets that land on Casper.
- Constant on-chain activity: trades, x402 settlements, resolutions, payouts.

## What's built and working
- Five autonomous trader agents (2 heuristic, 3 LLM personas) that pay for data and trade on-chain — the leaderboard shows better beliefs taking money from worse ones.
- A resolver agent that settles deterministic markets on two agreeing price sources.
- An LLM jury + on-chain staked commit-reveal (TruthStake) for "unsignable" markets, with slashing verified in tests.
- A consumer agent that pays x402 to read the oracle and acts on it.
- A Next.js dashboard: live probability, agent feed, oracle terminal, all with explorer links.
- A ~30-line bring-your-own-agent example and an MCP server as the open on-ramp.

## Live on Casper testnet (network: casper-test)
- sUSD (CEP-18, x402-capable) — package `8538c4e9…423ca17`
- MarketFactory — package `b1c836f5…c28c0a40`
- BinaryMarketFactory (codegen) — package `2f4dbe03…9ef9302a5`
- Markets created on-chain by the factory: probe `3359a9dc…` (**resolved NO**, tx `8a367cf92cc56815353d9a47dd42cb6777e0c4540f69aec54fa50e58d728ddac`), BTC/USD Jul-6 `ed2e5206…`, CSPR/USD Jul-5 `809ab03d…`
- The probe market ran a full lifecycle on-chain: ~32 trades → dual-source resolution → winners paid, losers slashed.

Full hashes and install receipts in `deployments.json`.

## Honest trade-offs
- Buy-only markets (sell-side is a stretch goal); buys alone move price and drive the demo.
- Testnet prototype demonstrating the pattern — traders and markets are ours; volume is seeded. Every trade/payment/resolution is a genuine on-chain transaction.
- Jury runs one LLM provider; mitigated by on-chain stake behind resolution. Multi-provider is roadmap.

## Roadmap
RWA outcome markets as market-resolved data feeds; reputation-weighted juries; multi-provider adjudication + dispute windows; mainnet.

## Links
- GitHub: https://github.com/neromtoobad/sooth
- Demo video: _<paste once recorded>_
- Explorer (resolution receipt): https://testnet.cspr.live/transaction/8a367cf92cc56815353d9a47dd42cb6777e0c4540f69aec54fa50e58d728ddac

---

## CSPR.fans / X vote post (draft)
> SOOTH is live on Casper testnet 🔮 Prediction markets where AI agents pay x402 for data, trade their beliefs, and the price is sold back as a truth oracle. Attestation oracles sign truth — SOOTH *prices* it, with skin in the game. x402 in, x402 out. truth, priced live. [link] #Casper #x402
