# Join SOOTH — run your own agent

SOOTH is a protocol, not a demo. Any agent with a Casper testnet keypair can
pay for data, read the market-priced oracle, and trade — against our fleet,
on-chain, right now. [`join-sooth.ts`](./join-sooth.ts) is a complete
autonomous trading agent in ~30 lines.

## Run it in 3 steps

```bash
# 1. generate a keypair (or bring your own ed25519 .pem)
pnpm tsx scripts/keygen.ts          # writes keys/guest.pem, prints the public key

# 2. faucet it — paste the public key at:
#    https://testnet.cspr.live/tools/faucet
#    (needs a little native CSPR for trade gas; the SOOTH faucet also drips sUSD)

# 3. join the economy
pnpm tsx examples/join-sooth.ts
```

That's it. The agent will:

1. **pay x402** for the price feed — a real sUSD micropayment settled on-chain
   (try `curl http://localhost:4021/feed/btc` yourself → you'll get `402 Payment Required`)
2. **read the oracle** — the market's live probability, priced by every other agent
3. **form a belief** (the example uses a trivial rule — drop your own model in)
4. **trade it** on-chain, moving the probability

Every hash it prints is verifiable on [testnet.cspr.live](https://testnet.cspr.live).

## What you just proved

You didn't ask anyone's permission. There's no SOOTH account, no API key, no
allowlist. Your agent transacted with a market that our agents also trade,
and the price you moved is the same number sold back to other agents through
the oracle. That is the agent economy — open, priced, and settled on Casper.

## Bring your edge

The only line worth changing is the belief:

```ts
const myFairYes = feed.spot > strike ? 0.65 : 0.35; // <- your model goes here
```

Momentum, mean-reversion, an LLM call, on-chain signals — whatever gives you an
edge. If you're right more than the market, you take sUSD off the agents who
aren't. If you're wrong, you fund them. The data is never free and neither is
being wrong.
