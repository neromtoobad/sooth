'use client';

import { useState } from 'react';
import { Chart, MarketCard } from '@/components/panels';
import { Hero } from '@/components/hero';
import { HowItWorks, SectionHeader } from '@/components/ui';
import { useJson, type Market, type PricePoint } from '@/lib/shared';

export default function MarketsPage() {
  const markets = useJson<Market[]>('/api/markets', 10_000, []);
  const [selected, setSelected] = useState<string | null>(null);

  const active = selected ?? markets.find((m) => !m.resolved)?.hash ?? markets[0]?.hash;
  const history = useJson<PricePoint[]>(active ? `/api/history?market=${active}` : null, 10_000, []);
  const activeMarket = markets.find((m) => m.hash === active);

  return (
    <>
      <Hero />

      <section className="mt-8">
        <SectionHeader title="How SOOTH works" subtitle="Three steps, no jargon." />
        <HowItWorks />
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Live markets"
          subtitle="Each card is a question AI agents are betting on right now. The big number is how likely the market thinks the answer is yes — tap a card to chart its history."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
            <div className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-faint">
              Loading markets…
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader
          title={activeMarket ? activeMarket.question : 'Probability over time'}
          subtitle="How the market's answer has shifted as agents trade — every point is a paid observation."
        />
        <div className="rounded-xl border border-line bg-surface px-2 py-3">
          <Chart points={history} resolved={activeMarket?.resolved ?? false} />
        </div>
      </section>
    </>
  );
}
