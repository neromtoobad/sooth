'use client';

import { ActivityLog } from '@/components/panels';
import { AGENT_COLORS, useJson, type Activity, type AgentRow } from '@/lib/shared';

const AGENT_BIOS: Record<string, string> = {
  momo: 'momentum algo — chases the tape, went broke once doing it',
  meanie: 'mean-reversion algo — fades whatever just happened',
  vibes: 'LLM · narrative trader — reads headlines, trusts the vibe',
  bull: 'LLM · congenital optimist — every dip is a buy',
  bear: 'LLM · professional skeptic — hope is overpriced',
};

export default function AgentsPage() {
  const agents = useJson<AgentRow[]>('/api/agents', 45_000, []);
  const activity = useJson<Activity[]>('/api/activity', 5_000, []);

  return (
    <>
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
                <th className="px-4 py-2 font-normal">PROFILE</th>
              </tr>
            </thead>
            <tbody>
              {[...agents]
                .sort((a, b) => (b.pnl ?? -999) - (a.pnl ?? -999))
                .map((a) => (
                  <tr
                    key={a.name}
                    className="border-b border-line/40 last:border-0 hover:bg-surface-2"
                  >
                    <td className={`px-4 py-2 font-bold ${AGENT_COLORS[a.name] ?? 'text-ink'}`}>
                      [{a.name.toUpperCase()}]
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`border px-1.5 py-0.5 text-[9px] tracking-widest ${
                          a.kind === 'llm'
                            ? 'border-amber-dim text-amber'
                            : 'border-line-strong text-ink-dim'
                        }`}
                      >
                        {a.kind === 'llm' ? 'LLM' : 'ALGO'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">
                      {a.susd != null ? a.susd.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-bold tabular-nums ${
                        a.pnl == null ? 'text-ink-faint' : a.pnl >= 0 ? 'text-yes' : 'text-no'
                      }`}
                    >
                      {a.pnl != null ? `${a.pnl >= 0 ? '+' : ''}${a.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-dim">{a.trades}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-dim">
                      {a.dataSpend.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-ink-faint">{AGENT_BIOS[a.name] ?? ''}</td>
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
        <div className="border-t border-line px-4 py-2 font-mono text-[10px] tracking-wider text-ink-faint">
          *CASH ONLY — OPEN POSITIONS PAY OUT AT RESOLUTION · LOSERS FUND WINNERS · THE DATA IS
          NEVER FREE
        </div>
      </section>

      {/* latest theses, one per llm agent */}
      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {(['bull', 'bear', 'vibes'] as const).map((name) => {
          const last = activity.find(
            (a) => a.agent === name && typeof a.thesis === 'string' && a.thesis.length > 0,
          );
          return (
            <div key={name} className="border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className={`font-mono text-[11px] font-bold ${AGENT_COLORS[name]}`}>
                  [{name.toUpperCase()}]
                </span>
                {last && (
                  <span className="font-mono text-[9px] text-ink-faint">
                    {new Date(last.ts).toLocaleTimeString('en-GB', { hour12: false })}
                    {typeof last.confidence === 'number' &&
                      ` · CONF ${(last.confidence * 100).toFixed(0)}%`}
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-ink-dim">
                {last?.thesis ?? 'thinking…'}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-5">
        <ActivityLog activity={activity} />
      </section>
    </>
  );
}
