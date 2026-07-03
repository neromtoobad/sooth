// sooth oracle — the product. market-priced truth, sold per read via x402.
// GET /oracle/:marketHash → { p_yes, pools, question, ... } gated at ~1 sUSD/call
import express from 'express';
import { buildGate } from '@sooth/lib/x402.ts';
import { SoothClient, loadDeployments } from '@sooth/lib/sooth.ts';
import { pemPathFor } from '@sooth/lib/x402-client.ts';

const PORT = Number(process.env.ORACLE_PORT ?? 4023);
const CACHE_MS = 10_000;

const cache = new Map<string, { at: number; data: unknown }>();
let reader: SoothClient | null = null;

async function readMarket(marketHash: string) {
  const hit = cache.get(marketHash);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  reader ??= await SoothClient.connect(pemPathFor('deployer'));
  const info = await reader.marketInfo(marketHash);
  const data = {
    market_hash: marketHash,
    question: info.question,
    p_yes: info.pYes,
    yes_pool: info.yesPool.toString(),
    no_pool: info.noPool.toString(),
    close_ts: info.closeTs,
    resolved: info.resolved,
    outcome: info.outcome,
    ts: Date.now(),
  };
  cache.set(marketHash, { at: Date.now(), data });
  return data;
}

const app = express();

if (process.env.X402_DISABLED === '1') {
  console.warn('x402 gate DISABLED (dev mode) — oracle reads are free');
} else {
  app.use(
    await buildGate({
      'GET /oracle/:marketHash': {
        price: process.env.X402_ORACLE_PRICE ?? '$0.001',
        description:
          'sooth oracle — live market-implied probability for this question. truth, priced live.',
      },
    }),
  );
}

app.get('/oracle/:marketHash', async (req, res) => {
  try {
    res.json(await readMarket(req.params.marketHash));
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.get('/markets', async (_req, res) => {
  // ungated discovery endpoint: list available markets so consumers know what to pay for
  try {
    res.json(loadDeployments().markets);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`sooth oracle listening on :${PORT} — GET /oracle/:marketHash is x402-gated`);
});
