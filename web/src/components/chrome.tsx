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

/** single sticky top bar: brand · section nav · status */
export function TopNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-40 -mx-5 border-b border-line bg-bg/90 px-5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="SOOTH"
            className="h-8 w-8 border border-line object-cover"
          />
          <span className="font-mono text-lg font-bold tracking-tight text-ink">
            SOOTH<span className="block-cursor text-amber">▮</span>
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`relative px-3 py-4 font-mono text-[11px] tracking-[0.2em] transition-colors sm:px-4 ${
                  active ? 'text-amber' : 'text-ink-dim hover:text-ink'
                }`}
              >
                {t.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-amber" />}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-4 font-mono text-[10px] tracking-widest sm:flex">
          <span className="flex items-center gap-1.5 text-yes">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-yes" />
            LIVE · TESTNET
          </span>
          <a
            href={EXPLORER}
            target="_blank"
            className="text-ink-dim transition-colors hover:text-amber"
          >
            EXPLORER ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/** slim stats strip under the nav */
export function Ticker() {
  const markets = useJson<Market[]>('/api/markets', 15_000, []);
  const activity = useJson<Activity[]>('/api/activity', 10_000, []);

  const stats = useMemo(() => {
    const payments = activity.filter((a) => a.x402_payment).length;
    const trades = markets.reduce((s, m) => s + m.trades, 0);
    const spot = activity.find((a) => typeof a.spot === 'number' && (a.spot as number) > 1)?.spot;
    return { payments, trades, spot };
  }, [activity, markets]);

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-1 border-b border-line/60 py-2 text-[11px] text-ink-faint">
      {stats.spot && (
        <span>
          BTC <span className="font-mono text-ink-dim">${stats.spot.toLocaleString()}</span>
        </span>
      )}
      <span>
        on-chain trades <span className="font-mono text-ink-dim">{stats.trades}</span>
      </span>
      <span>
        micropayments <span className="font-mono text-amber">{stats.payments}</span>
      </span>
      <span className="hidden md:inline">everything here is a real transaction on Casper</span>
    </div>
  );
}
