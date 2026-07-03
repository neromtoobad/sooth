import { NextResponse } from 'next/server';
import { loadMarkets, marketView, readActivity } from '@/server/chain';

export const dynamic = 'force-dynamic';

const X402_PRICE = 0.5;

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 30_000) return NextResponse.json(cache.data);

  const activity = readActivity(4000);
  const payments = activity.filter((a) => a.x402_payment).length;

  const metas = loadMarkets();
  let fees = 0;
  let resolvedCount = 0;
  for (const m of metas) {
    const v = await marketView(m);
    if (v.resolved) resolvedCount += 1;
  }
  // trading fees: 1% of every buy the log has seen (authoritative fees live
  // on-chain via fees(); log-derived keeps this panel independent of rpc mood)
  fees = activity
    .filter((a) => a.action === 'buy_yes' || a.action === 'buy_no')
    .reduce((s, a) => s + (typeof a.size === 'number' ? a.size * 0.01 : 0), 0);

  const data = {
    x402Revenue: payments * X402_PRICE,
    x402Payments: payments,
    tradingFees: fees,
    markets: metas.length,
    resolved: resolvedCount,
    note: 'revenue accrues to the protocol account in sUSD — the oracle funds itself',
  };
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
