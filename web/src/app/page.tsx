'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const EXPLORER = 'https://testnet.cspr.live';

interface Market {
  hash: string;
  question: string;
  closeTs: number;
  strike?: number;
  pYes: number;
  yesPool: string;
  noPool: string;
  resolved: boolean;
  outcome: boolean | null;
  trades: number;
}

interface Activity {
  ts: number;
  agent: string;
  action: string;
  market?: string;
  signal?: string;
  size?: number;
  p_yes?: number;
  spot?: number;
  txHash?: string | null;
  x402_payment?: string | null;
  thesis?: string;
  decision?: string;
  error?: string;
}

interface PricePoint {
  ts: number;
  p: number;
}

function useJson<T>(url: string, intervalMs: number, initial: T): T {
  const [data, setData] = useState<T>(initial);
  const tick = useCallback(async () => {
    try {
      const r = await fetch(url);
      if (r.ok) setData(await r.json());
    } catch {
      /* keep last */
    }
  }, [url]);
  useEffect(() => {
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [tick, intervalMs]);
  return data;
}

function countdown(closeTs: number): string {
  const ms = closeTs - Date.now();
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function short(hash: string, n = 8): string {
  return hash.slice(0, n) + '…';
}

const AGENT_COLORS: Record<string, string> = {
  momo: 'text-sky-400',
  meanie: 'text-amber-400',
  vibes: 'text-fuchsia-400',
  resolver: 'text-emerald-400',
  consumer: 'text-teal-300',
  deployer: 'text-zinc-400',
};

function Chart({ points, resolved }: { points: PricePoint[]; resolved: boolean }) {
  const { path, lo, hi } = useMemo(() => {
    if (points.length < 2) return { path: null, lo: 0, hi: 1 };
    const ps = points.map((p) => p.p);
    const lo = Math.max(0, Math.min(...ps) - 0.05);
    const hi = Math.min(1, Math.max(...ps) + 0.05);
    const t0 = points[0].ts;
    const span = Math.max(points[points.length - 1].ts - t0, 1);
    const coords = points.map((pt) => {
      const x = ((pt.ts - t0) / span) * 1000;
      const y = 300 - ((pt.p - lo) / (hi - lo)) * 300;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { path: coords.join(' '), lo, hi };
  }, [points]);

  const gridlines = useMemo(() => {
    const lines: number[] = [];
    for (let g = 0.1; g < 1; g += 0.1) {
      const gr = Math.round(g * 10) / 10;
      if (gr > lo && gr < hi) lines.push(gr);
    }
    return lines;
  }, [lo, hi]);

  return (
    <div className="relative">
      <svg viewBox="0 0 1000 300" className="h-56 w-full" preserveAspectRatio="none">
        {gridlines.map((g) => (
          <line
            key={g}
            x1="0"
            x2="1000"
            y1={300 - ((g - lo) / (hi - lo)) * 300}
            y2={300 - ((g - lo) / (hi - lo)) * 300}
            stroke="#27272a"
            strokeWidth="1"
          />
        ))}
        {path ? (
          <polyline
            points={path}
            fill="none"
            stroke={resolved ? '#71717a' : '#10b981'}
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <text x="500" y="150" textAnchor="middle" fill="#52525b" fontSize="16">
            waiting for observations…
          </text>
        )}
      </svg>
      {path && (
        <>
          <span className="absolute right-1 top-0 text-[10px] text-zinc-600">
            {(hi * 100).toFixed(0)}%
          </span>
          <span className="absolute bottom-0 right-1 text-[10px] text-zinc-600">
            {(lo * 100).toFixed(0)}%
          </span>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const markets = useJson<Market[]>('/api/markets', 10_000, []);
  const activity = useJson<Activity[]>('/api/activity', 5_000, []);
  const [selected, setSelected] = useState<string | null>(null);

  const active = selected ?? markets.find((m) => !m.resolved)?.hash ?? markets[0]?.hash;
  const history = useJson<PricePoint[]>(
    active ? `/api/history?market=${active}` : '/api/history',
    10_000,
    [],
  );
  const activeMarket = markets.find((m) => m.hash === active);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* header */}
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            SOOTH <span className="font-normal text-zinc-500">— truth, priced live</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            market-priced oracle for the agent economy · casper testnet · every trade, payment and
            resolution is a real on-chain transaction
          </p>
        </div>
        <a
          href={EXPLORER}
          target="_blank"
          className="text-xs text-zinc-500 hover:text-emerald-400"
        >
          testnet.cspr.live ↗
        </a>
      </header>

      {/* market cards */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        {markets.map((m) => (
          <button
            key={m.hash}
            onClick={() => setSelected(m.hash)}
            className={`rounded-xl border p-5 text-left transition ${
              m.hash === active
                ? 'border-emerald-600 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-snug text-zinc-300">{m.question}</p>
              {m.resolved ? (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    m.outcome ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-950 text-rose-300'
                  }`}
                >
                  {m.outcome ? 'YES' : 'NO'}
                </span>
              ) : (
                <span className="whitespace-nowrap text-xs text-zinc-500">
                  {m.closeTs > Date.now() ? `closes ${countdown(m.closeTs)}` : 'closed · resolving…'}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span
                className={`text-4xl font-bold tabular-nums ${
                  m.resolved ? 'text-zinc-500' : 'text-emerald-400'
                }`}
              >
                {(m.pYes * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-zinc-500">
                {m.trades} trades ·{' '}
                <a
                  href={`${EXPLORER}/contract-package/${m.hash}`}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-emerald-400"
                >
                  {short(m.hash)}
                </a>
              </span>
            </div>
          </button>
        ))}
      </section>

      {/* chart */}
      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-400">
            p(YES) — {activeMarket ? activeMarket.question : '…'}
          </h2>
          <span className="text-xs text-zinc-600">agents&apos; paid observations · 0–100%</span>
        </div>
        <Chart points={history} resolved={activeMarket?.resolved ?? false} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* activity feed */}
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">agent activity</h2>
          <div className="max-h-[32rem] space-y-1.5 overflow-y-auto pr-1">
            {activity
              .filter((a) => a.action !== 'error' || !a.error?.includes('Network'))
              .slice(0, 60)
              .map((a, i) => (
                <div
                  key={`${a.ts}-${i}`}
                  className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${AGENT_COLORS[a.agent] ?? 'text-zinc-300'}`}>
                      {a.agent}
                    </span>
                    <span
                      className={
                        a.action.startsWith('buy')
                          ? 'font-semibold text-emerald-300'
                          : a.action === 'error'
                            ? 'text-rose-400'
                            : 'text-zinc-400'
                      }
                    >
                      {a.action}
                      {a.size ? ` ${a.size.toFixed(2)} sUSD` : ''}
                    </span>
                    {typeof a.p_yes === 'number' && (
                      <span className="text-zinc-500">p={(a.p_yes * 100).toFixed(1)}%</span>
                    )}
                    <span className="ml-auto text-zinc-600">
                      {new Date(a.ts).toLocaleTimeString('en-GB', { hour12: false })}
                    </span>
                  </div>
                  {(a.signal || a.thesis || a.decision) && (
                    <p className="mt-1 text-zinc-500">{a.thesis ?? a.decision ?? a.signal}</p>
                  )}
                  <div className="mt-1 flex gap-3 text-[11px] text-zinc-600">
                    {a.txHash && (
                      <a
                        href={`${EXPLORER}/transaction/${a.txHash}`}
                        target="_blank"
                        className="hover:text-emerald-400"
                      >
                        trade tx {short(a.txHash)} ↗
                      </a>
                    )}
                    {a.x402_payment && (
                      <a
                        href={`${EXPLORER}/transaction/${a.x402_payment}`}
                        target="_blank"
                        className="hover:text-sky-400"
                      >
                        x402 payment {short(a.x402_payment)} ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            {activity.length === 0 && (
              <p className="text-xs text-zinc-600">no activity yet — agents warming up</p>
            )}
          </div>
        </section>

        {/* oracle panel */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">consume this oracle</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs leading-relaxed text-zinc-400">
            <p>
              the live probability <em>is</em> the product. any agent can buy a read with an x402
              micropayment in sUSD — no account, no API key, just a wallet:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-3 text-[11px] text-zinc-300">
              {`$ curl sooth-oracle/oracle/${short(active ?? '', 10)}
→ 402 Payment Required
  (PAYMENT-REQUIRED header: price, asset, payTo)

$ # client signs an sUSD transfer authorization
$ # and retries with PAYMENT-SIGNATURE …
→ 200 OK  { "p_yes": ${activeMarket ? activeMarket.pYes.toFixed(3) : '0.500'}, … }
  settlement lands on-chain, receipt in
  the PAYMENT-RESPONSE header`}
            </pre>
            <p className="mt-3">
              x402 is used twice: agents <span className="text-sky-300">pay for data in</span>{' '}
              (price feed) and <span className="text-teal-300">pay for truth out</span> (this
              oracle). attestation oracles say &quot;trust my signature.&quot; sooth prices truth
              with skin in the game.
            </p>
            <div className="mt-3 border-t border-zinc-800 pt-3 text-[11px] text-zinc-500">
              stack: odra contracts · casper x402 + facilitator · cspr.cloud · casper-js-sdk ·
              testnet receipts for everything
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
