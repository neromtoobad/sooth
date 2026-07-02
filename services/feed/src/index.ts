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

let cache: { at: number; data: FeedPayload } | null = null;

async function fetchBtc(): Promise<FeedPayload> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [spotRes, chartRes] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
    fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1'),
  ]);
  if (!spotRes.ok || !chartRes.ok) {
    if (cache) return cache.data; // serve stale over failing
    throw new Error(`coingecko upstream error: ${spotRes.status}/${chartRes.status}`);
  }
  const spot = (await spotRes.json()) as { bitcoin: { usd: number } };
  const chart = (await chartRes.json()) as { prices: [number, number][] };
  const data: FeedPayload = {
    spot: spot.bitcoin.usd,
    series_24h: chart.prices,
    ts: Date.now(),
  };
  cache = { at: Date.now(), data };
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
    }),
  );
}

app.get('/feed/btc', async (_req, res) => {
  try {
    res.json(await fetchBtc());
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true })); // ungated

app.listen(PORT, () => {
  console.log(`sooth feed listening on :${PORT} — GET /feed/btc is x402-gated`);
});
