'use client';

import { useMemo } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import {
  AGENT_COLORS,
  EXPLORER,
  actionLabel,
  countdown,
  short,
  useJson,
  type Activity,
  type Market,
  type PricePoint,
} from '@/lib/shared';

/* ── sparkline (24h P(YES), hand-rolled) ───────────────────────── */

function Sparkline({ market }: { market: string }) {
  const points = useJson<PricePoint[]>(`/api/history?market=${market}`, 30_000, []);
  const path = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600_000;
    const pts = points.filter((p) => p.ts >= cutoff);
    if (pts.length < 2) return null;
    const ps = pts.map((p) => p.p);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps);
    const span = Math.max(pts[pts.length - 1].ts - pts[0].ts, 1);
    const range = Math.max(hi - lo, 0.01);
    const xy = pts.map((pt) => [
      ((pt.ts - pts[0].ts) / span) * 200,
      36 - ((pt.p - lo) / range) * 30 - 3,
    ]);
    return {
      line: xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      area: `0,36 ${xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} 200,36`,
    };
  }, [points]);

  if (!path) return <div className="h-9" />;
  return (
    <svg viewBox="0 0 200 36" className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`spark-${market.slice(0, 6)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8b435" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#e8b435" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={path.area} fill={`url(#spark-${market.slice(0, 6)})`} />
      <polyline
        points={path.line}
        fill="none"
        stroke="#e8b435"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── chart ─────────────────────────────────────────────────────── */

export function Chart({ points, resolved }: { points: PricePoint[]; resolved: boolean }) {
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

  const color = resolved ? '#8a877e' : '#e8b435';

  return (
    <div className="relative">
      {/* glass observations chip */}
      <div className="glass glass-frame-dim absolute right-3 top-2 z-10 flex items-center gap-2 rounded-full px-3 py-1">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-amber" />
        <span className="font-mono text-[9px] tracking-widest text-ink-dim">
          AGENTS&apos; PAID OBSERVATIONS · {points.length}
        </span>
      </div>
      <svg viewBox="0 0 1000 300" className="h-64 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
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
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            strokeDasharray="1 7"
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
          <span className="absolute right-2 top-10 font-mono text-[10px] text-ink-faint">
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

export function MarketCard({
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
      className={`glass glass-8 group relative cursor-pointer rounded-xl p-0 text-left transition-all duration-200 hover:-translate-y-[2px] ${
        active ? 'glass-frame' : 'glass-frame glass-frame-dim hover:brightness-125'
      }`}
    >
      <div className="flex items-center justify-between border-b border-line/60 px-4 py-2">
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

        {/* 24h sparkline */}
        <div className="mt-2">
          <Sparkline market={m.hash} />
        </div>

        {/* YES / NO split — animated, glowing divider */}
        <div className="mt-1">
          <div className="relative flex h-1 overflow-visible">
            <div className="bar-animate bg-yes/70" style={{ width: `${noShare * 100}%` }} />
            <div
              className="bar-animate bg-no/60"
              style={{ width: `${(1 - noShare) * 100}%` }}
            />
            <span
              className="absolute top-1/2 h-[5px] w-px -translate-y-1/2 bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)]"
              style={{ left: `${noShare * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[9px] tracking-widest text-ink-faint">
            <span>YES {(noShare * 100).toFixed(0)}</span>
            <span>NO {((1 - noShare) * 100).toFixed(0)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── activity log ──────────────────────────────────────────────── */

export function ActivityLog({
  activity,
  maxHeight = 'max-h-[34rem]',
  limit = 80,
}: {
  activity: Activity[];
  maxHeight?: string;
  limit?: number;
}) {
  const feed = useMemo(
    () =>
      activity
        .filter((a) => a.action !== 'error' || !(a.error ?? '').match(/Network|429/))
        .slice(0, limit),
    [activity, limit],
  );
  const newestTs = feed[0]?.ts ?? 0;

  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] text-ink-dim">
          <ActivityIcon size={12} className="text-amber" />
          AGENT ACTIVITY LOG
        </h2>
        <span className="font-mono text-[10px] text-ink-faint">tail -f activity.jsonl</span>
      </div>
      <div className={`terminal-scroll ${maxHeight} overflow-y-auto px-1 py-1`}>
        {feed.map((a, i) => {
          const act = actionLabel(a);
          const isVibesThesis = a.agent === 'vibes' && a.thesis;
          return (
            <div
              key={`${a.ts}-${i}`}
              className={`border-b border-line/40 px-3 py-2 font-mono text-[11px] leading-relaxed last:border-0 hover:bg-surface-2 ${
                a.ts === newestTs && Date.now() - a.ts < 15_000 ? 'feed-row-new' : ''
              }`}
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
                  <span className="text-ink-faint">
                    {a.spot > 1 ? `btc=${a.spot.toLocaleString()}` : `cspr=${a.spot}`}
                  </span>
                )}
              </div>
              {(a.thesis ?? a.decision ?? a.signal) && (
                <p
                  className={`mt-0.5 ${
                    isVibesThesis ? 'italic text-white/60' : 'text-ink-faint'
                  }`}
                >
                  {a.thesis ?? a.decision ?? a.signal}
                </p>
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
  );
}
