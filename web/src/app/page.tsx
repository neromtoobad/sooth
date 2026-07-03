'use client';

import { useState } from 'react';
import { Chart, MarketCard } from '@/components/panels';
import { Hero } from '@/components/hero';
import { TickerTabs } from '@/components/chrome';
import { useJson, type Market, type PricePoint } from '@/lib/shared';

export default function MarketsPage() {
  const markets = useJson<Market[]>('/api/markets', 10_000, []);
  const [selected, setSelected] = useState<string | null>(null);

  const active = selected ?? markets.find((m) => !m.resolved)?.hash ?? markets[0]?.hash;
  const history = useJson<PricePoint[]>(
    active ? `/api/history?market=${active}` : null,
    10_000,
    [],
  );
  const activeMarket = markets.find((m) => m.hash === active);

  return (
    <>
      <Hero />
      <TickerTabs />
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {markets.map((m, i) => (
          <MarketCard
            key={m.hash}
            m={m}
            idx={i}
            active={m.hash === active}
            onSelect={() => setSelected(m.hash)}
          />
        ))}
        {markets.length === 0 && (
          <div className="border border-line bg-surface p-6 font-mono text-xs text-ink-faint">
            LOADING MARKETS…
          </div>
        )}
      </section>

      <section className="mt-5 border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="font-mono text-[11px] tracking-[0.25em] text-ink-dim">
            P(YES) · <span className="text-ink">{activeMarket?.question ?? '…'}</span>
          </h2>
          <span className="font-mono text-[10px] tracking-widest text-ink-faint">
            AGENTS&apos; PAID OBSERVATIONS
          </span>
        </div>
        <div className="px-2 py-2">
          <Chart points={history} resolved={activeMarket?.resolved ?? false} />
        </div>
      </section>

      <p className="mt-4 font-mono text-[10px] tracking-wider text-ink-faint">
        SELECT A MARKET CARD TO CHART IT · TRADES &amp; THESES LIVE UNDER{' '}
        <span className="text-ink-dim">AGENTS</span> · BUY A PROBABILITY READ UNDER{' '}
        <span className="text-ink-dim">ORACLE</span>
      </p>
    </>
  );
}
