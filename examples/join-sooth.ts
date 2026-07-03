/**
 * JOIN SOOTH — a complete autonomous trading agent in one file.
 *
 * This is the whole point of SOOTH: it is a protocol, not a walled garden.
 * Any agent with a Casper keypair can pay for data, read the market-priced
 * oracle, and trade its beliefs — no account, no API key, no permission.
 *
 * Run it:
 *   1. generate a key + faucet it (see examples/README.md)
 *   2. pnpm tsx examples/join-sooth.ts
 *
 * Everything below is real: real x402 micropayments, real on-chain trades,
 * every hash printed is verifiable on testnet.cspr.live.
 */
import { join } from 'path';
import { SoothClient, loadDeployments, toNano } from '../lib/sooth.ts';
import { payingFetch, settlementRef } from '../lib/x402-client.ts';
import { EXPLORER } from '../lib/casper.ts';

const KEY = process.env.KEY_PATH ?? join(import.meta.dirname, '..', 'keys', 'guest.pem');
const FEED = process.env.FEED_URL ?? 'http://localhost:4021/feed/btc';

// 1. connect your wallet + a fetch that auto-handles x402 (402 → sign → retry)
const me = await SoothClient.connect(KEY);
const pay = await payingFetch(KEY);

// pick the first open market to trade
const market = loadDeployments().markets.find((m) => m.closeTs > Date.now());
if (!market) throw new Error('no open markets');
console.log(`agent ${me.publicKeyHex.slice(0, 12)}… joining "${market.question}"`);

// let the market pull collateral from you (one-time approval)
await me.approve(market.hash, toNano(1000));

// 2. PAY FOR DATA. curl this without payment → 402. with a wallet → 200.
const res = await pay(FEED);
const feed = (await res.json()) as { spot: number };
console.log(`paid for data → BTC $${feed.spot}   [x402 settlement ${await settlementRef(res)}]`);

// 3. READ THE ORACLE. the market's live probability — priced by other agents.
const pYes = await me.priceYes(market.hash);
console.log(`the market believes YES @ ${(pYes * 100).toFixed(1)}%`);

// 4. FORM A BELIEF and 5. TRADE IT. (trivial rule here — bring your own edge.)
//    if you think YES is underpriced, buy YES; overpriced, buy NO.
const strike = market.strike ?? feed.spot;
const myFairYes = feed.spot > strike ? 0.65 : 0.35; // <- your model goes here
if (Math.abs(myFairYes - pYes) < 0.05) {
  console.log('market looks fairly priced — holding.');
} else {
  const side = myFairYes > pYes ? 'YES' : 'NO';
  const tx =
    side === 'YES'
      ? await me.buyYes(market.hash, toNano(2))
      : await me.buyNo(market.hash, toNano(2));
  console.log(`bought 2 sUSD of ${side} → ${EXPLORER}/transaction/${tx}`);
  console.log(`new market probability: ${((await me.priceYes(market.hash)) * 100).toFixed(1)}%`);
}

console.log('\nthat is the entire agent. you are now part of the economy.');
