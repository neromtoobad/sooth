'use client';

import { useMemo, useState } from 'react';
import { Chart, MarketCard, StatStrip } from '@/components/panels';
import { Hero } from '@/components/hero';
import { HowItWorks, SectionHeader } from '@/components/ui';
import { useJson, type Market, type PricePoint } from '@/lib/shared';

export default function MarketsPage() {
  const markets = useJson<Market[]>('/api/markets', 10_000, []);
  const [selected, setSelected] = useState<string | null>(null);

  const active = selected ?? markets.find((m) => !m.resolved)?.hash ?? markets[0]?.hash;
  const history = useJson<PricePoint[]>(active ? `/api/history?market=${active}` : null, 10_000, []);
  const activeMarket = markets.find((m) => m.hash === active);

  // trend for the big-number chart header: first vs last observation
  const trend = useMemo(() => {
    if (history.length < 2) return null;
    return (history[history.length - 1].p - history[0].p) * 100;
  }, [history]);
  const pNow = activeMarket ? activeMarket.pYes * 100 : history.at(-1)?.p != null ? history.at(-1)!.p * 100 : null;

  return (
    <>
      <Hero />

      <section className="mt-2">
        <StatStrip />
      </section>

      <section className="mt-10">
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
            <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-faint">
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
        <div className="rounded-2xl border border-line bg-surface px-3 py-4">
          {/* big-number header, over the chart */}
          <div className="mb-1 flex items-end justify-between px-1">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                {activeMarket?.resolved ? 'Final probability' : 'Live probability of yes'}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`font-mono text-[40px] font-bold leading-none tabular-nums ${
                    activeMarket?.resolved ? 'text-ink-dim' : 'text-amber'
                  }`}
                >
                  {pNow != null ? pNow.toFixed(1) : '—'}
                  <span className="text-[20px]">%</span>
                </span>
                {trend != null && (
                  <span
                    className={`font-mono text-[12px] ${
                      trend >= 0 ? 'text-yes' : 'text-no'
                    }`}
                  >
                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)} pts
                  </span>
                )}
              </div>
            </div>
          </div>
          <Chart points={history} resolved={activeMarket?.resolved ?? false} />
        </div>
      </section>
    </>
  );
}
