import { NextResponse } from 'next/server';
import { loadMarkets, marketView, type MarketView } from '@/server/chain';

export const dynamic = 'force-dynamic';

let cache: { at: number; data: MarketView[] } | null = null;
const TTL = 10_000;
// last view per market that actually contained events — served when a
// transient rpc failure would otherwise reset a card to 50% / 0 trades
const lastGood = new Map<string, MarketView>();

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json(cache.data);
  }
  const metas = loadMarkets();
  const views = await Promise.all(
    metas.map(async (m) => {
      const v = await marketView(m);
      const prev = lastGood.get(m.hash);
      if (v.trades === 0 && prev && prev.trades > 0) return prev;
      if (v.trades > 0) lastGood.set(m.hash, v);
      return v;
    }),
  );
  cache = { at: Date.now(), data: views };
  return NextResponse.json(views);
}
