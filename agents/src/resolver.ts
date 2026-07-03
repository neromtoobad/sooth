// resolver — the only key authorized to resolve markets. routes by market kind:
//   • deterministic (crypto closes): two independent price sources must agree
//     within 0.5%, then resolve(outcome) on-chain.
//   • subjective (unsignable truth): convene an LLM jury (agents/src/jury.ts).
//     supermajority resolves on-chain; disagreement opens a dispute window.
// after resolution, claim winnings for every agent.
import { pemPathFor } from '@sooth/lib/x402-client.ts';
import { SoothClient, loadDeployments } from '@sooth/lib/sooth.ts';
import { logActivity } from './base.ts';
import { adjudicate } from './jury.ts';

const AGREE_TOLERANCE = 0.005;
const POLL_MS = 30_000;

interface MarketMeta {
  hash: string;
  question: string;
  closeTs: number;
  strike?: number;
  kind?: 'deterministic' | 'subjective';
  criteria?: string;
}

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
  for (const name of ['deployer', 'momo', 'meanie', 'vibes', 'bull', 'bear']) {
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

/** deterministic markets: dual-source price vs strike. returns outcome or throws. */
async function resolveDeterministic(market: MarketMeta): Promise<boolean> {
  const price = await deterministicBtc();
  const strike = market.strike ?? strikeFromQuestion(market.question);
  const outcome = price > strike;
  logActivity({
    agent: 'resolver',
    action: 'resolving',
    market: market.hash,
    kind: 'deterministic',
    price,
    strike,
    outcome,
  });
  return outcome;
}

/** subjective markets: convene the jury. returns outcome, or null if disputed. */
async function resolveSubjective(market: MarketMeta): Promise<boolean | null> {
  logActivity({
    agent: 'resolver',
    action: 'resolving',
    market: market.hash,
    kind: 'subjective',
    thesis: 'no data source can answer this — convening the jury',
  });
  const jury = await adjudicate(market.hash, market.question, market.criteria ?? '');
  if (!jury.decided) {
    logActivity({
      agent: 'jury',
      action: 'disputed',
      market: market.hash,
      thesis: jury.rationale,
    });
    return null;
  }
  logActivity({
    agent: 'jury',
    action: 'ruled',
    market: market.hash,
    outcome: jury.outcome,
    thesis: jury.rationale,
  });
  return jury.outcome!;
}

async function main() {
  const client = await SoothClient.connect(pemPathFor('resolver'));
  const handled = new Set<string>(); // markets fully resolved AND claims attempted
  const juryCooldown = new Map<string, number>(); // don't re-run jury every 30s while disputed

  logActivity({ agent: 'resolver', action: 'start' });

  for (;;) {
    try {
      const { markets } = loadDeployments() as { markets: MarketMeta[] };
      for (const market of markets) {
        if (handled.has(market.hash)) continue;
        if (Date.now() < market.closeTs) continue;

        const info = await client.marketInfo(market.hash);
        if (!info.resolved) {
          let outcome: boolean | null;
          if (market.kind === 'subjective') {
            // a disputed jury re-convenes at most every 30 min (dispute window)
            const next = juryCooldown.get(market.hash) ?? 0;
            if (Date.now() < next) continue;
            outcome = await resolveSubjective(market);
            if (outcome === null) {
              juryCooldown.set(market.hash, Date.now() + 30 * 60_000);
              continue; // stays open; jury tries again after the window
            }
          } else {
            outcome = await resolveDeterministic(market);
          }

          const txHash = await client.resolve(market.hash, outcome);
          logActivity({
            agent: 'resolver',
            action: 'resolved',
            market: market.hash,
            kind: market.kind ?? 'deterministic',
            outcome,
            txHash,
          });
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
