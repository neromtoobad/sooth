import { NextResponse } from 'next/server';
import { loadMarkets, marketView, type MarketView } from '@/server/chain';

export const dynamic = 'force-dynamic';

let cache: { at: number; data: MarketView[] } | null = null;
const TTL = 10_000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json(cache.data);
  }
  const metas = loadMarkets();
  const views = await Promise.all(metas.map((m) => marketView(m)));
  cache = { at: Date.now(), data: views };
  return NextResponse.json(views);
}
