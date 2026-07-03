import { NextResponse } from 'next/server';
import { loadMarkets, readActivity } from '@/server/chain';

export const dynamic = 'force-dynamic';

/** price history per market, derived from the agents' logged observations.
 * entries logged before market-tagging existed belong to the first market. */
export function GET(req: Request) {
  const market = new URL(req.url).searchParams.get('market');
  const firstMarket = loadMarkets()[0]?.hash;
  const points = readActivity(2000)
    .filter(
      (e) =>
        typeof e.p_yes === 'number' &&
        (e.market === market || (!e.market && market === firstMarket)),
    )
    .map((e) => ({ ts: e.ts, p: e.p_yes as number }))
    .reverse(); // oldest first
  return NextResponse.json(points);
}
