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

interface AgentRow {
  name: string;
  kind: 'heuristic' | 'llm';
  susd: number | null;
  pnl: number | null;
  cspr: number | null;
  trades: number;
  dataSpend: number;
  lastThesis: string | null;
  lastAction: string | null;
  lastTs: number | null;
}

interface Economy {
  x402Revenue: number;
  x402Payments: number;
  tradingFees: number;
  markets: number;
  resolved: number;
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
  if (ms <= 0) return 'CLOSED';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}D ${h % 24}H`;
  return `${h}H ${m.toString().padStart(2, '0')}M`;
}

function short(hash: string, n = 8): string {
  return hash.slice(0, n);
}

const AGENT_COLORS: Record<string, string> = {
  momo: 'text-info',
  meanie: 'text-amber',
  vibes: 'text-[#a3e635]',
  bull: 'text-yes',
  bear: 'text-no',
  resolver: 'text-yes',
  consumer: 'text-[#5eead4]',
  deployer: 'text-ink-dim',
};

function actionLabel(a: Activity): { text: string; cls: string } {
  if (a.action === 'buy_yes') return { text: `BUY YES ${a.size?.toFixed(2)} sUSD`, cls: 'text-yes' };
  if (a.action === 'buy_no') return { text: `BUY NO ${a.size?.toFixed(2)} sUSD`, cls: 'text-no' };
  if (a.action === 'hold') return { text: 'HOLD', cls: 'text-ink-faint' };
  if (a.action === 'oracle_read') return { text: 'ORACLE READ', cls: 'text-[#5eead4]' };
  if (a.action === 'resolving' || a.action === 'resolved')
    return { text: a.action.toUpperCase(), cls: 'text-amber' };
  if (a.action === 'claimed') return { text: 'CLAIMED', cls: 'text-yes' };
  if (a.action === 'error') return { text: 'ERR', cls: 'text-no/70' };
  return { text: a.action.toUpperCase(), cls: 'text-ink-dim' };
}

/* ── chart ─────────────────────────────────────────────────────── */

function Chart({ points, resolved }: { points: PricePoint[]; resolved: boolean }) {
  const { path, area, lo, hi, lastXY } = useMemo(() => {
    if (points.length < 2)
      return {
        path: null as string | null,
        area: null as string | null,
        lo: 0,
        hi: 1,
        lastXY: null as [number, number] | null,
      };
    const ps = points.map((p) => p.p);
    const lo = Math.max(0, Math.min(...ps) - 0.04);
    const hi = Math.min(1, Math.max(...ps) + 0.04);
    const t0 = points[0].ts;
    const span = Math.max(points[points.length - 1].ts - t0, 1);
    const xy = points.map((pt) => [
      ((pt.ts - t0) / span) * 1000,
      300 - ((pt.p - lo) / (hi - lo)) * 280 - 10,
    ]);
    const path = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `0,300 ${path} 1000,300`;
    return { path, area, lo, hi, lastXY: xy[xy.length - 1] as [number, number] };
  }, [points]);

  const color = resolved ? '#8a877e' : '#f5b800';

  return (
    <div className="relative">
      <svg viewBox="0 0 1000 300" className="h-64 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2="1000"
            y1={300 - f * 280 - 10}
            y2={300 - f * 280 - 10}
            stroke="#262624"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        ))}
        {path && <polygon points={area!} fill="url(#fill)" />}
        {path ? (
          <>
            <polyline
              points={path}
              fill="none"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {lastXY && !resolved && (
              <circle cx={lastXY[0]} cy={lastXY[1]} r="4" fill={color} className="live-dot" />
            )}
          </>
        ) : (
          <text
            x="500"
            y="150"
            textAnchor="middle"
            fill="#55534c"
            fontSize="13"
            fontFamily="var(--font-mono)"
          >
            AWAITING OBSERVATIONS
          </text>
        )}
      </svg>
      {path && (
        <>
          <span className="absolute right-2 top-1 font-mono text-[10px] text-ink-faint">
            {(hi * 100).toFixed(0)}
          </span>
          <span className="absolute bottom-1 right-2 font-mono text-[10px] text-ink-faint">
            {(lo * 100).toFixed(0)}
          </span>
        </>
      )}
      {resolved && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-line-strong px-4 py-1 font-mono text-xs tracking-[0.3em] text-ink-faint">
          RESOLVED
        </span>
      )}
    </div>
  );
}

/* ── market card ───────────────────────────────────────────────── */

function MarketCard({
  m,
  idx,
  active,
  onSelect,
}: {
  m: Market;
  idx: number;
  active: boolean;
  onSelect: () => void;
}) {
  let noShare = 0.5;
  try {
    const yes = Number(BigInt(m.yesPool) / 1000000n);
    const no = Number(BigInt(m.noPool) / 1000000n);
    if (yes + no > 0) noShare = no / (yes + no); // p_yes = no/(yes+no)
  } catch {
    /* negative/malformed pools from partial event reads — keep 50/50 */
  }

  return (
    <button
      onClick={onSelect}
      className={`group relative cursor-pointer border bg-surface p-0 text-left transition-colors duration-200 ${
        active ? 'border-amber-dim' : 'border-line hover:border-line-strong'
      }`}
    >
      {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-amber" />}
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.25em] text-ink-faint">
          MARKET {String(idx + 1).padStart(2, '0')} · {short(m.hash)}
        </span>
        {m.resolved ? (
          <span
            className={`border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest ${
              m.outcome ? 'border-yes/40 text-yes' : 'border-no/40 text-no'
            }`}
          >
            {m.outcome ? 'YES' : 'NO'}
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-widest text-ink-dim">
            {m.closeTs > Date.now() ? `T-${countdown(m.closeTs)}` : 'CLOSED · RESOLVING'}
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="min-h-[2.5rem] text-sm leading-snug text-ink">{m.question}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10px] tracking-[0.25em] text-ink-faint">P(YES)</span>
            <div
              className={`font-mono text-5xl font-bold tabular-nums leading-none ${
                m.resolved ? 'text-ink-dim' : 'text-amber'
              }`}
            >
              {(m.pYes * 100).toFixed(1)}
              <span className="text-2xl">%</span>
            </div>
          </div>
          <div className="text-right font-mono text-[10px] leading-relaxed text-ink-faint">
            <div>{m.trades} TRADES</div>
            <a
              href={`${EXPLORER}/contract-package/${m.hash}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="text-ink-dim underline-offset-2 hover:text-amber hover:underline"
            >
              CONTRACT ↗
            </a>
          </div>
        </div>

        {/* YES / NO pool split */}
        <div className="mt-3">
          <div className="flex h-1 overflow-hidden">
            <div className="bg-yes/70" style={{ width: `${noShare * 100}%` }} />
            <div className="bg-no/60" style={{ width: `${(1 - noShare) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] tracking-widest text-ink-faint">
            <span>YES {(noShare * 100).toFixed(0)}</span>
            <span>NO {((1 - noShare) * 100).toFixed(0)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

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

  const agents = useJson<AgentRow[]>('/api/agents', 45_000, []);
  const economy = useJson<Economy | null>('/api/economy', 30_000, null);

  const stats = useMemo(() => {
    const payments = activity.filter((a) => a.x402_payment).length;
    const trades = markets.reduce((s, m) => s + m.trades, 0);
    const spot = activity.find((a) => typeof a.spot === 'number')?.spot;
    return { payments, trades, spot };
  }, [activity, markets]);

  const feed = useMemo(
    () =>
      activity
        .filter((a) => a.action !== 'error' || !(a.error ?? '').match(/Network|429/))
        .slice(0, 80),
    [activity],
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber/80 pb-4">
        <div className="flex items-center gap-4">
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
        </div>
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

      {/* market cards */}
      <section className="mt-5 grid gap-3 sm:grid-cols-2">
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

      {/* chart */}
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

      {/* the economy: agents get paid or go broke */}
      <section className="mt-5 border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="font-mono text-[11px] tracking-[0.25em] text-ink-dim">
            AGENT LEADERBOARD — INTELLIGENCE, PRICED
          </h2>
          <span className="font-mono text-[10px] tracking-widest text-ink-faint">
            EVERY AGENT PAYS FOR ITS OWN DATA
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-line text-left text-[9px] tracking-[0.2em] text-ink-faint">
                <th className="px-4 py-2 font-normal">AGENT</th>
                <th className="px-2 py-2 font-normal">TYPE</th>
                <th className="px-2 py-2 text-right font-normal">sUSD</th>
                <th className="px-2 py-2 text-right font-normal">CASH P&amp;L*</th>
                <th className="px-2 py-2 text-right font-normal">TRADES</th>
                <th className="px-2 py-2 text-right font-normal">DATA SPEND</th>
                <th className="px-4 py-2 font-normal">LATEST CALL</th>
              </tr>
            </thead>
            <tbody>
              {[...agents]
                .sort((a, b) => (b.pnl ?? -999) - (a.pnl ?? -999))
                .map((a) => (
                  <tr key={a.name} className="border-b border-line/40 last:border-0 hover:bg-surface-2">
                    <td className={`px-4 py-2 font-bold ${AGENT_COLORS[a.name] ?? 'text-ink'}`}>
                      [{a.name.toUpperCase()}]
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`border px-1.5 py-0.5 text-[9px] tracking-widest ${
                          a.kind === 'llm' ? 'border-amber-dim text-amber' : 'border-line-strong text-ink-dim'
                        }`}
                      >
                        {a.kind === 'llm' ? 'LLM' : 'ALGO'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">
                      {a.susd != null ? a.susd.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`px-2 py-2 text-right tabular-nums font-bold ${
                        a.pnl == null ? 'text-ink-faint' : a.pnl >= 0 ? 'text-yes' : 'text-no'
                      }`}
                    >
                      {a.pnl != null ? `${a.pnl >= 0 ? '+' : ''}${a.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-dim">{a.trades}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-dim">
                      {a.dataSpend.toFixed(1)}
                    </td>
                    <td className="max-w-[22rem] truncate px-4 py-2 text-ink-faint">
                      {a.lastThesis ?? '…'}
                    </td>
                  </tr>
                ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-ink-faint">
                    LOADING AGENTS…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {economy && (
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-line px-4 py-2 font-mono text-[10px] tracking-wider text-ink-faint">
            <span>
              PROTOCOL REVENUE{' '}
              <span className="text-amber">{economy.x402Revenue.toFixed(1)} sUSD</span> FROM{' '}
              <span className="text-ink">{economy.x402Payments}</span> X402 CALLS
            </span>
            <span>
              TRADING FEES <span className="text-amber">{economy.tradingFees.toFixed(2)} sUSD</span>
            </span>
            <span>
              MARKETS <span className="text-ink">{economy.markets}</span> · RESOLVED{' '}
              <span className="text-ink">{economy.resolved}</span>
            </span>
            <span className="text-ink-faint">*CASH ONLY — OPEN POSITIONS PAY AT RESOLUTION · THE ORACLE FUNDS ITSELF</span>
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        {/* activity log */}
        <section className="lg:col-span-3">
          <div className="border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <h2 className="font-mono text-[11px] tracking-[0.25em] text-ink-dim">
                AGENT ACTIVITY LOG
              </h2>
              <span className="font-mono text-[10px] text-ink-faint">tail -f activity.jsonl</span>
            </div>
            <div className="terminal-scroll max-h-[30rem] overflow-y-auto px-1 py-1">
              {feed.map((a, i) => {
                const act = actionLabel(a);
                return (
                  <div
                    key={`${a.ts}-${i}`}
                    className="border-b border-line/40 px-3 py-2 font-mono text-[11px] leading-relaxed last:border-0 hover:bg-surface-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-ink-faint">
                        {new Date(a.ts).toLocaleTimeString('en-GB', { hour12: false })}
                      </span>
                      <span className={`font-bold ${AGENT_COLORS[a.agent] ?? 'text-ink'}`}>
                        [{a.agent.toUpperCase()}]
                      </span>
                      <span className={`font-bold ${act.cls}`}>{act.text}</span>
                      {typeof a.p_yes === 'number' && (
                        <span className="text-ink-dim">p={(a.p_yes * 100).toFixed(1)}%</span>
                      )}
                      {typeof a.spot === 'number' && (
                        <span className="text-ink-faint">btc={a.spot.toLocaleString()}</span>
                      )}
                    </div>
                    {(a.thesis ?? a.decision ?? a.signal) && (
                      <p className="mt-0.5 text-ink-faint">{a.thesis ?? a.decision ?? a.signal}</p>
                    )}
                    {(a.txHash || a.x402_payment) && (
                      <div className="mt-1 flex gap-2">
                        {a.txHash && (
                          <a
                            href={`${EXPLORER}/transaction/${a.txHash}`}
                            target="_blank"
                            className="border border-line px-1.5 py-0.5 text-[9px] tracking-widest text-ink-dim transition-colors hover:border-amber-dim hover:text-amber"
                          >
                            TX {short(a.txHash, 6)} ↗
                          </a>
                        )}
                        {a.x402_payment && (
                          <a
                            href={`${EXPLORER}/transaction/${a.x402_payment}`}
                            target="_blank"
                            className="border border-line px-1.5 py-0.5 text-[9px] tracking-widest text-ink-dim transition-colors hover:border-info hover:text-info"
                          >
                            X402 {short(a.x402_payment, 6)} ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {feed.length === 0 && (
                <p className="px-3 py-4 font-mono text-[11px] text-ink-faint">
                  NO ACTIVITY YET — AGENTS WARMING UP
                </p>
              )}
            </div>
          </div>
        </section>

        {/* oracle panel */}
        <section className="lg:col-span-2">
          <div className="border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <span className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-no/60" />
                <span className="h-2 w-2 rounded-full bg-amber/60" />
                <span className="h-2 w-2 rounded-full bg-yes/60" />
              </span>
              <h2 className="font-mono text-[11px] tracking-[0.25em] text-ink-dim">
                CONSUME THIS ORACLE
              </h2>
            </div>
            <div className="space-y-3 px-4 py-4 text-xs leading-relaxed text-ink-dim">
              <p>
                the live probability <em className="text-ink">is</em> the product. any agent can
                buy a read with an x402 micropayment in sUSD — no account, no API key, just a
                wallet:
              </p>
              <pre className="overflow-x-auto border border-line bg-bg p-3 font-mono text-[10px] leading-relaxed text-ink-dim">
                <span className="text-ink">$ curl sooth/oracle/{short(active ?? '', 10)}…</span>
                {'\n'}
                <span className="text-no">← 402 PAYMENT REQUIRED</span>
                {'\n'}
                {'   asset: sUSD · price: 1/call · payTo: sooth'}
                {'\n\n'}
                <span className="text-ink-faint"># client signs sUSD transfer authorization</span>
                {'\n'}
                <span className="text-ink-faint"># retries with PAYMENT-SIGNATURE header</span>
                {'\n'}
                <span className="text-yes">
                  ← 200 OK {'{'} &quot;p_yes&quot;:{' '}
                  {activeMarket ? activeMarket.pYes.toFixed(3) : '0.500'} {'}'}
                </span>
                {'\n'}
                {'   settlement lands on-chain'}
              </pre>
              <p>
                x402 runs <span className="text-ink">twice</span>: agents{' '}
                <span className="text-info">pay for data in</span> (price feed) and{' '}
                <span className="text-[#5eead4]">pay for truth out</span> (this oracle).
              </p>
              <p className="border-l-2 border-amber/60 pl-3 text-ink">
                attestation oracles say &quot;trust my signature.&quot; sooth prices truth with
                skin in the game.
              </p>
              <div className="border-t border-line pt-3 font-mono text-[9px] tracking-wider text-ink-faint">
                ODRA CONTRACTS · CASPER X402 + FACILITATOR · CSPR.CLOUD · CASPER-JS-SDK
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-line pt-3 font-mono text-[10px] tracking-widest text-ink-faint">
        <span>SOOTH · CASPER AGENTIC BUILDATHON 2026</span>
        <span>TRADER AGENTS: MOMO · MEANIE · VIBES — RESOLVER · CONSUMER</span>
      </footer>
    </main>
  );
}
