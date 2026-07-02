// shared agent runtime: pay x402 → fetch feed → compute signal → trade → log.
// crash-safe (a failed cycle never kills the loop), rate-capped, jsonl activity log.
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { payingFetch, pemPathFor, settlementRef } from '@sooth/lib/x402-client.ts';
import { SoothClient, fromNano, toNano } from '@sooth/lib/sooth.ts';

export interface FeedData {
  spot: number;
  series_24h: [number, number][];
  ts: number;
}

export interface AgentContext {
  feed: FeedData;
  pYes: number; // current market probability 0..1
  strike: number; // market strike price
  history: number[]; // recent pYes observations (oldest first)
}

export interface Decision {
  action: 'buy_yes' | 'buy_no' | 'hold';
  size: number; // sUSD
  signal: string; // human-readable reason, shown on dashboard
}

export interface AgentConfig {
  name: string;
  marketHash: string;
  strike: number;
  intervalMs: number;
  maxTradeSusd: number;
  feedUrl: string;
}

const LOG_PATH = join(import.meta.dirname, '..', '..', 'activity.jsonl');

export function logActivity(entry: Record<string, unknown>) {
  const line = JSON.stringify({ ts: Date.now(), ...entry });
  console.log(line);
  try {
    appendFileSync(LOG_PATH, line + '\n');
  } catch {
    mkdirSync(join(LOG_PATH, '..'), { recursive: true });
    appendFileSync(LOG_PATH, line + '\n');
  }
}

export function envConfig(name: string): AgentConfig {
  return {
    name,
    marketHash: process.env.MARKET_HASH ?? '',
    strike: Number(process.env.STRIKE ?? 0),
    intervalMs: Number(process.env.AGENT_INTERVAL_MS ?? 30_000),
    maxTradeSusd: Number(process.env.MAX_TRADE_SUSD ?? 5),
    feedUrl: process.env.FEED_URL ?? 'http://localhost:4021/feed/btc',
  };
}

/** logistic squash for price-distance → probability models */
export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export async function runAgent(
  cfg: AgentConfig,
  decide: (ctx: AgentContext) => Decision,
): Promise<never> {
  if (!cfg.marketHash) throw new Error('MARKET_HASH env required');
  if (!cfg.strike) throw new Error('STRIKE env required');

  const client = await SoothClient.connect(pemPathFor(cfg.name));
  const fetchPaid = await payingFetch(pemPathFor(cfg.name));
  const history: number[] = [];

  logActivity({ agent: cfg.name, action: 'start', market: cfg.marketHash });

  // one-time big allowance so the market can pull trade collateral
  try {
    const approveTx = await client.approve(cfg.marketHash, toNano(100_000));
    logActivity({ agent: cfg.name, action: 'approve', txHash: approveTx });
  } catch (e) {
    logActivity({ agent: cfg.name, action: 'error', error: `approve failed: ${String(e)}` });
  }

  for (;;) {
    const cycleStart = Date.now();
    try {
      // 1. pay x402 for data
      const res = await fetchPaid(cfg.feedUrl);
      if (!res.ok) throw new Error(`feed ${res.status}`);
      const feed = (await res.json()) as FeedData;
      const paymentRef = await settlementRef(res);

      // 2. read market
      const pYes = await client.priceYes(cfg.marketHash);
      history.push(pYes);
      if (history.length > 60) history.shift();

      // 3. decide
      const decision = decide({ feed, pYes, strike: cfg.strike, history: [...history] });
      const size = Math.min(decision.size, cfg.maxTradeSusd);

      // 4. trade
      let txHash: string | null = null;
      if (decision.action !== 'hold' && size > 0) {
        txHash =
          decision.action === 'buy_yes'
            ? await client.buyYes(cfg.marketHash, toNano(size))
            : await client.buyNo(cfg.marketHash, toNano(size));
      }

      logActivity({
        agent: cfg.name,
        action: decision.action,
        signal: decision.signal,
        size,
        p_yes: pYes,
        spot: feed.spot,
        txHash,
        x402_payment: paymentRef,
      });
    } catch (e) {
      logActivity({ agent: cfg.name, action: 'error', error: String(e) });
    }

    const elapsed = Date.now() - cycleStart;
    await new Promise((r) => setTimeout(r, Math.max(cfg.intervalMs - elapsed, 5_000)));
  }
}

/** spot price N minutes ago from the 24h series */
export function spotAgo(feed: FeedData, minutes: number): number {
  const target = feed.ts - minutes * 60_000;
  let best = feed.series_24h[0];
  for (const point of feed.series_24h) {
    if (Math.abs(point[0] - target) < Math.abs(best[0] - target)) best = point;
  }
  return best[1];
}
