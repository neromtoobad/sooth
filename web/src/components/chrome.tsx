'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  LayoutGrid,
  Users,
  Radio,
  Code2,
  ExternalLink,
  Boxes,
  type LucideIcon,
} from 'lucide-react';
import { EXPLORER, useJson, type Activity, type Market } from '@/lib/shared';

type NavItem = { href: string; label: string; tag: string; icon: LucideIcon };
type NavGroup = { section: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    section: 'Overview',
    items: [{ href: '/', label: 'Markets', tag: 'live prices', icon: LayoutGrid }],
  },
  {
    section: 'Surfaces',
    items: [
      { href: '/agents', label: 'Agents', tag: 'the traders', icon: Users },
      { href: '/oracle', label: 'Oracle', tag: 'x402 feed', icon: Radio },
    ],
  },
];

const CRUMB: Record<string, string> = {
  '/': 'Markets',
  '/agents': 'Agents',
  '/oracle': 'Oracle',
};

/** persistent left rail — the app shell */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      {/* brand */}
      <Link href="/" className="flex items-center gap-3 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="SOOTH"
          className="h-9 w-9 rounded-lg border border-amber/40 object-cover"
        />
        <span className="leading-tight">
          <span className="block font-mono text-[15px] font-bold tracking-tight text-ink">
            SOOTH
          </span>
          <span className="block font-mono text-[9px] tracking-[0.18em] text-ink-faint">
            truth, priced live
          </span>
        </span>
      </Link>

      {/* nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <div className="px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
              {group.section}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                      active
                        ? 'bg-amber text-bg'
                        : 'text-ink-dim hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} className="shrink-0" />
                    <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                    <span
                      className={`font-mono text-[9px] tracking-wide ${
                        active ? 'text-bg/55' : 'text-ink-faint'
                      }`}
                    >
                      {item.tag}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* external */}
        <div className="mb-2">
          <div className="px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
            Learn
          </div>
          <div className="space-y-0.5">
            <a
              href="https://github.com/neromtoobad/sooth"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Code2 size={16} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 text-[13px] font-medium">GitHub</span>
              <ExternalLink size={12} className="text-ink-faint" />
            </a>
            <a
              href={EXPLORER}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Boxes size={16} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 text-[13px] font-medium">Explorer</span>
              <ExternalLink size={12} className="text-ink-faint" />
            </a>
          </div>
        </div>
      </nav>

      <StatusCards />
    </aside>
  );
}

/** sticky "it's real" anchors at the bottom of the rail */
function StatusCards() {
  const markets = useJson<Market[]>('/api/markets', 15_000, []);
  const activity = useJson<Activity[]>('/api/activity', 10_000, []);
  const stats = useMemo(() => {
    const payments = activity.filter((a) => a.x402_payment).length;
    const trades = markets.reduce((s, m) => s + m.trades, 0);
    return { payments, trades };
  }, [activity, markets]);

  return (
    <div className="space-y-2 border-t border-line p-3">
      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <div className="flex items-center gap-1.5">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-yes" />
          <span className="font-mono text-[9px] tracking-[0.18em] text-yes">TESTNET · LIVE</span>
        </div>
        <div className="mt-1 text-[10px] leading-snug text-ink-faint">
          every action is a real transaction on Casper
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <div className="font-mono text-[9px] tracking-[0.18em] text-ink-faint">ON-CHAIN</div>
        <div className="mt-1 flex items-baseline gap-3 font-mono text-[13px] text-ink">
          <span>
            <span className="tabular-nums">{stats.trades}</span>{' '}
            <span className="text-[9px] text-ink-faint">trades</span>
          </span>
          <span>
            <span className="tabular-nums text-amber">{stats.payments}</span>{' '}
            <span className="text-[9px] text-ink-faint">x402</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** breadcrumb + network chrome, plus the mobile nav */
export function TopBar() {
  const pathname = usePathname();
  const crumb = CRUMB[pathname] ?? 'Markets';
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between gap-4 px-5 md:px-8">
        {/* mobile brand */}
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SOOTH" className="h-7 w-7 rounded-md border border-amber/40" />
          <span className="font-mono text-sm font-bold text-ink">SOOTH</span>
        </Link>

        {/* desktop breadcrumb */}
        <div className="hidden items-center gap-2 font-mono text-[12px] lg:flex">
          <span className="text-ink-faint">SOOTH</span>
          <span className="text-ink-faint">/</span>
          <span className="text-ink">{crumb}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] tracking-widest text-ink-dim">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-amber" />
            CASPER TESTNET
          </span>
          <a
            href={EXPLORER}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 font-mono text-[10px] tracking-widest text-ink-faint transition-colors hover:text-amber sm:flex"
          >
            EXPLORER <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* mobile tab row */}
      <nav className="flex gap-1 border-t border-line px-3 lg:hidden">
        {NAV.flatMap((g) => g.items).map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2.5 font-mono text-[11px] tracking-widest transition-colors ${
                active ? 'text-amber' : 'text-ink-dim'
              }`}
            >
              {item.label.toUpperCase()}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
