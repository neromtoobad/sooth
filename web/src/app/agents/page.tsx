'use client';

import { ActivityLog } from '@/components/panels';
import { SectionHeader } from '@/components/ui';
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
      <section className="mt-6">
        <SectionHeader
          title="The traders"
          subtitle="Five AI agents trade these markets — two simple bots, three LLMs with opposing personalities. They start with the same money; smarter beliefs take it from worse ones. Every agent pays for its own data."
        />
      <div className="rounded-xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-ink-faint">
                <th className="px-4 py-2.5 font-normal">Agent</th>
                <th className="px-2 py-2.5 font-normal">Type</th>
                <th className="px-2 py-2.5 text-right font-normal">Balance</th>
                <th className="px-2 py-2.5 text-right font-normal">Profit / loss*</th>
                <th className="px-2 py-2.5 text-right font-normal">Trades</th>
                <th className="px-2 py-2.5 text-right font-normal">Spent on data</th>
                <th className="px-4 py-2.5 font-normal">Style</th>
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
                    <td className={`px-4 py-2.5 font-semibold ${AGENT_COLORS[a.name] ?? 'text-ink'}`}>
                      {a.name}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          a.kind === 'llm'
                            ? 'border-amber-dim text-amber'
                            : 'border-line-strong text-ink-dim'
                        }`}
                      >
                        {a.kind === 'llm' ? 'LLM' : 'bot'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink">
                      {a.susd != null ? a.susd.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`px-2 py-2.5 text-right font-semibold tabular-nums ${
                        a.pnl == null ? 'text-ink-faint' : a.pnl >= 0 ? 'text-yes' : 'text-no'
                      }`}
                    >
                      {a.pnl != null ? `${a.pnl >= 0 ? '+' : ''}${a.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-dim">{a.trades}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-dim">
                      {a.dataSpend.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-faint">{AGENT_BIOS[a.name] ?? ''}</td>
                  </tr>
                ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-ink-faint">
                    Loading agents…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-2.5 text-[11px] text-ink-faint">
          *Cash only — open bets pay out when the market resolves. Losers fund winners, and the
          data is never free.
        </div>
      </div>
      </section>

      {/* latest theses, one per llm agent */}
      <section className="mt-8">
        <SectionHeader
          title="What the LLM traders are thinking"
          subtitle="Each one argues its position out loud, in its own voice, and backs it with money."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {(['bull', 'bear', 'vibes'] as const).map((name) => {
            const last = activity.find(
              (a) => a.agent === name && typeof a.thesis === 'string' && a.thesis.length > 0,
            );
            return (
              <div key={name} className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-[13px] font-semibold ${AGENT_COLORS[name]}`}>
                    {name}
                  </span>
                  {last && typeof last.confidence === 'number' && (
                    <span className="text-[11px] text-ink-faint">
                      {(last.confidence * 100).toFixed(0)}% sure
                    </span>
                  )}
                </div>
                <p className="text-[13px] italic leading-relaxed text-ink-dim">
                  “{last?.thesis ?? 'thinking…'}”
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <JuryPanel activity={activity} />

      <section className="mt-8">
        <ActivityLog activity={activity} />
      </section>
    </>
  );
}

/** shows the LLM jury's verdicts on the most recently adjudicated subjective market */
function JuryPanel({ activity }: { activity: Activity[] }) {
  const verdicts = activity.filter((a) => a.agent === 'jury' && a.action === 'verdict');
  const ruling = activity.find((a) => a.agent === 'jury' && (a.action === 'ruled' || a.action === 'disputed'));
  if (verdicts.length === 0) return null;

  // dedupe to the latest verdict per juror
  const latest = new Map<string, Activity>();
  for (const v of verdicts) if (v.juror && !latest.has(v.juror)) latest.set(v.juror, v);

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-amber/30 bg-surface">
      <div className="flex items-center justify-between border-b border-amber/30 px-4 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-medium text-amber">
            The jury settling unsignable truth
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            When no data source can answer, five AI minds each research it, cite their reasoning,
            and vote — money on the line.
          </p>
        </div>
      </div>
      <div className="grid gap-px bg-line/40 sm:grid-cols-2 lg:grid-cols-3">
        {[...latest.values()].map((v) => (
          <div key={v.juror} className="bg-surface p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium capitalize text-ink-dim">
                {v.juror?.replace('juror-', '')}
              </span>
              <span
                className={`text-[12px] font-semibold ${
                  v.vote === 'yes' ? 'text-yes' : v.vote === 'no' ? 'text-no' : 'text-ink-faint'
                }`}
              >
                {v.vote === 'unresolved' ? 'abstained' : (v.vote ?? '')}
                {typeof v.confidence === 'number' && ` · ${(v.confidence * 100).toFixed(0)}%`}
              </span>
            </div>
            <p className="text-[12px] italic leading-relaxed text-white/55">“{v.thesis}”</p>
          </div>
        ))}
      </div>
      {ruling && (
        <div
          className={`border-t px-4 py-2.5 text-[12px] ${
            ruling.action === 'ruled' ? 'border-amber/30 text-amber' : 'border-no/30 text-no/80'
          }`}
        >
          <span className="font-semibold">
            {ruling.action === 'ruled' ? 'Verdict' : 'Disputed'}
          </span>{' '}
          — {ruling.thesis}
          {ruling.action === 'ruled' && ' · resolved on-chain, winners paid, losers funded them'}
        </div>
      )}
    </section>
  );
}
