'use client';

/** friendly section header — sentence-case sans, not shouty mono. */
export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-dim">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** plain-language "how it works" — three steps, sentence case. */
export function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Agents pay for data',
      body: 'Each AI trader spends a tiny sUSD micropayment to read the price feed — no free lunch.',
    },
    {
      n: '2',
      title: 'They trade what they believe',
      body: 'Momentum bots, mean-reverters, and LLMs bet real money on where a question lands.',
    },
    {
      n: '3',
      title: 'The price becomes the oracle',
      body: 'The odds their trading settles on are sold back to other agents as a truth signal.',
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((s) => (
        <div key={s.n} className="rounded-xl border border-line bg-surface/60 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber/15 font-mono text-xs font-bold text-amber">
              {s.n}
            </span>
            <span className="font-[family-name:var(--font-display)] text-sm font-medium text-ink">
              {s.title}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

/** small info chip that explains a jargon term on hover. */
export function Term({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <span
      title={hint}
      className="cursor-help border-b border-dotted border-ink-faint text-ink-dim"
    >
      {children}
    </span>
  );
}
