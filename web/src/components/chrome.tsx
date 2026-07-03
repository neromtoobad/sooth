'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { EXPLORER, useJson, type Activity, type Market } from '@/lib/shared';

const TABS = [
  { href: '/', label: 'MARKETS' },
  { href: '/agents', label: 'AGENTS' },
  { href: '/oracle', label: 'ORACLE' },
];

/** top header only — pages render <TickerTabs/> below (home puts the hero between) */
export function HeaderBar() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber/80 pb-4">
      <Link href="/" className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="SOOTH logo — an eye whose upper lid is a stepped price line"
          className="h-14 w-14 shrink-0 border border-line object-cover"
        />
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-ink">
            SOOTH<span className="block-cursor text-amber">▮</span>
          </h1>
          <p className="mt-1 font-[family-name:var(--font-display)] text-sm text-ink-dim">
            truth, priced live — the market-priced oracle for the agent economy
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-5 font-mono text-[11px] tracking-widest">
        <span className="flex items-center gap-2 text-yes">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-yes" />
          LIVE
        </span>
        <span className="text-ink-faint">CASPER TESTNET</span>
        <a
          href={EXPLORER}
          target="_blank"
          className="text-ink-dim transition-colors hover:text-amber"
        >
          EXPLORER ↗
        </a>
      </div>
    </header>
  );
}

export function TickerTabs() {
  const pathname = usePathname();
  const markets = useJson<Market[]>('/api/markets', 15_000, []);
  const activity = useJson<Activity[]>('/api/activity', 10_000, []);

  const stats = useMemo(() => {
    const payments = activity.filter((a) => a.x402_payment).length;
    const trades = markets.reduce((s, m) => s + m.trades, 0);
    const spot = activity.find((a) => typeof a.spot === 'number' && (a.spot as number) > 1)?.spot;
    return { payments, trades, spot };
  }, [activity, markets]);

  return (
    <>
      {/* ticker strip */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-b border-line py-2 font-mono text-[11px] tracking-wider text-ink-dim">
        {stats.spot && (
          <span>
            BTC/USD <span className="text-ink">{stats.spot.toLocaleString()}</span>
          </span>
        )}
        <span>
          ON-CHAIN TRADES <span className="text-ink">{stats.trades}</span>
        </span>
        <span>
          X402 PAYMENTS <span className="text-amber">{stats.payments}</span>
          <span className="text-ink-faint"> (LAST {activity.length})</span>
        </span>
        <span className="hidden text-ink-faint sm:inline">
          EVERY TRADE · PAYMENT · RESOLUTION = REAL TX
        </span>
      </div>

      {/* section tabs */}
      <nav className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-5 py-2.5 font-mono text-[11px] tracking-[0.25em] transition-colors ${
                active
                  ? 'border-b-2 border-amber bg-surface text-amber'
                  : 'text-ink-dim hover:bg-surface hover:text-ink'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
