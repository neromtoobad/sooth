// sooth feed service — x402-gated BTC market data (CoinGecko proxy, 60s cache)
// plain curl → 402 · x402 client → 200 + on-chain settlement
import express from 'express';
import { buildGate } from '@sooth/lib/x402.ts';

const PORT = Number(process.env.FEED_PORT ?? 4021);
const CACHE_MS = 60_000;

interface FeedPayload {
  spot: number;
  series_24h: [number, number][]; // [ts, price]
  ts: number;
}

const GECKO_IDS: Record<string, string> = { btc: 'bitcoin', cspr: 'casper-network' };
const cache = new Map<string, { at: number; data: FeedPayload }>();

async function fetchAsset(asset: string): Promise<FeedPayload> {
  const id = GECKO_IDS[asset];
  if (!id) throw new Error(`unknown asset ${asset}`);
  const hit = cache.get(asset);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const [spotRes, chartRes] = await Promise.all([
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`),
    fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1`),
  ]);
  if (!spotRes.ok || !chartRes.ok) {
    if (hit) return hit.data; // serve stale over failing
    throw new Error(`coingecko upstream error: ${spotRes.status}/${chartRes.status}`);
  }
  const spot = (await spotRes.json()) as Record<string, { usd: number }>;
  const chart = (await chartRes.json()) as { prices: [number, number][] };
  const data: FeedPayload = {
    spot: spot[id].usd,
    series_24h: chart.prices,
    ts: Date.now(),
  };
  cache.set(asset, { at: Date.now(), data });
  return data;
}

const app = express();

if (process.env.X402_DISABLED === '1') {
  console.warn('x402 gate DISABLED (dev mode) — /feed/btc is free');
} else {
  app.use(
    await buildGate({
      'GET /feed/btc': {
        price: process.env.X402_FEED_PRICE ?? '$0.0005',
        description: 'BTC/USD spot + 24h series — sooth market data feed',
      },
      'GET /feed/cspr': {
        price: process.env.X402_FEED_PRICE ?? '$0.0005',
        description: 'CSPR/USD spot + 24h series — sooth market data feed',
      },
    }),
  );
}

app.get('/feed/:asset', async (req, res) => {
  try {
    res.json(await fetchAsset(req.params.asset));
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true })); // ungated

app.listen(PORT, () => {
  console.log(`sooth feed listening on :${PORT} — GET /feed/btc is x402-gated`);
});
