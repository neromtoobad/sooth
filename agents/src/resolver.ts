// resolver — the only key authorized to resolve markets.
// at close_ts: fetch BTC/USD from two independent sources, require agreement
// within 0.5%, post resolve(outcome) on-chain, then claim for winning agents.
import { pemPathFor } from '@sooth/lib/x402-client.ts';
import { SoothClient, loadDeployments } from '@sooth/lib/sooth.ts';
import { logActivity } from './base.ts';

const AGREE_TOLERANCE = 0.005;
const POLL_MS = 30_000;

async function btcFromCoinGecko(): Promise<number> {
  const r = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  );
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  return ((await r.json()) as { bitcoin: { usd: number } }).bitcoin.usd;
}

async function btcFromCoinbase(): Promise<number> {
  const r = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
  if (!r.ok) throw new Error(`coinbase ${r.status}`);
  return Number(((await r.json()) as { data: { amount: string } }).data.amount);
}

async function deterministicBtc(): Promise<number> {
  const [gecko, coinbase] = await Promise.all([btcFromCoinGecko(), btcFromCoinbase()]);
  const spread = Math.abs(gecko - coinbase) / gecko;
  if (spread > AGREE_TOLERANCE) {
    throw new Error(
      `sources disagree beyond ${AGREE_TOLERANCE * 100}%: gecko=${gecko} coinbase=${coinbase}`,
    );
  }
  return (gecko + coinbase) / 2;
}

function strikeFromQuestion(question: string): number {
  const m = question.replace(/,/g, '').match(/\$?(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`cannot parse strike from question: ${question}`);
  return Number(m[1]);
}

async function claimForAll(marketHash: string) {
  for (const name of ['deployer', 'momo', 'meanie', 'vibes']) {
    try {
      const agentClient = await SoothClient.connect(pemPathFor(name));
      const claimTx = await agentClient.claim(marketHash);
      logActivity({ agent: name, action: 'claimed', market: marketHash, txHash: claimTx });
    } catch (e) {
      // NothingToClaim is expected for losers — log and continue
      logActivity({ agent: name, action: 'claim_skipped', market: marketHash, note: String(e) });
    }
  }
}

async function main() {
  const client = await SoothClient.connect(pemPathFor('resolver'));
  const handled = new Set<string>(); // markets fully resolved AND claims attempted

  logActivity({ agent: 'resolver', action: 'start' });

  for (;;) {
    try {
      const { markets } = loadDeployments();
      for (const market of markets) {
        if (handled.has(market.hash)) continue;
        if (Date.now() < market.closeTs) continue;

        const info = await client.marketInfo(market.hash);
        if (!info.resolved) {
          const price = await deterministicBtc();
          // strike recorded at creation in deployments.json is the source of truth;
          // question parsing is the fallback for markets registered elsewhere
          const strike =
            (market as { strike?: number }).strike ?? strikeFromQuestion(market.question);
          const outcome = price > strike;

          logActivity({
            agent: 'resolver',
            action: 'resolving',
            market: market.hash,
            price,
            strike,
            outcome,
          });

          const txHash = await client.resolve(market.hash, outcome);
          logActivity({ agent: 'resolver', action: 'resolved', market: market.hash, outcome, txHash });
        }

        // claims run whether we just resolved or found it already resolved
        // (idempotent: double claims revert with NothingToClaim and get logged)
        await claimForAll(market.hash);
        handled.add(market.hash);
      }
    } catch (e) {
      logActivity({ agent: 'resolver', action: 'error', error: String(e) });
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

// casper-js-sdk's waitForTransaction can throw its Timeout from a raw timer
// callback, which bypasses try/catch — keep the resolver alive through those
process.on('uncaughtException', (e) => {
  logActivity({ agent: 'resolver', action: 'error', error: `uncaught: ${String(e)}` });
});
process.on('unhandledRejection', (e) => {
  logActivity({ agent: 'resolver', action: 'error', error: `unhandled: ${String(e)}` });
});

main();
