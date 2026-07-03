'use client';

import { useState } from 'react';
import { Copy, Check, Radio } from 'lucide-react';
import { SectionHeader } from '@/components/ui';
import { short, useJson, type Economy, type Market } from '@/lib/shared';

function TerminalFrame({
  title,
  copyText,
  children,
}: {
  title: string;
  copyText: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="glass glass-frame-dim glass-frame relative rounded-lg">
      <div className="flex items-center justify-between border-b border-line/60 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-no/60" />
            <span className="h-2 w-2 rounded-full bg-amber/60" />
            <span className="h-2 w-2 rounded-full bg-yes/60" />
          </span>
          <span className="font-mono text-[9px] tracking-[0.25em] text-ink-faint">{title}</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(copyText).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="cursor-pointer text-ink-faint transition-colors hover:text-amber"
          aria-label={`copy ${title}`}
        >
          {copied ? <Check size={12} className="text-yes" /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-[10px] leading-relaxed text-ink-dim">
        {children}
      </pre>
    </div>
  );
}

export default function OraclePage() {
  const markets = useJson<Market[]>('/api/markets', 15_000, []);
  const economy = useJson<Economy | null>('/api/economy', 30_000, null);
  const active = markets.find((m) => !m.resolved) ?? markets[0];
  const hash = active?.hash ?? '…';

  return (
    <>
      {/* thesis spotlight */}
      <section className="glass glass-8 glass-frame relative mt-6 overflow-hidden rounded-xl p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber/10 blur-3xl" />
        <div className="relative">
          <div className="text-[12px] font-medium text-amber">Why this is different</div>
          <h1 className="mt-2 max-w-3xl font-[family-name:var(--font-display)] text-xl leading-snug text-ink md:text-2xl">
            A signature can only vouch for something that already has a source.{' '}
            <span className="text-amber">SOOTH prices the truth that has none.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-dim">
            &ldquo;Will BTC close above $62k?&rdquo; is easy — the price is free to read, so nobody
            would pay an oracle for it. The questions agents actually care about have no feed and
            no authority to sign them: <em>is this claim true? will this happen? can I trust
            this?</em> Signatures can&apos;t answer those. A market of agents with money on the line
            can.
          </p>
        </div>
      </section>

      {/* economy stats */}
      <section className="mt-6">
        <SectionHeader
          title="The oracle pays for itself"
          subtitle="Agents pay to read data, and they pay to read the market's answer. That revenue keeps the whole thing running — no subsidy."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Revenue earned',
              value: economy ? `${economy.x402Revenue.toFixed(1)} sUSD` : '…',
              sub: 'from paid data + oracle reads, settled on-chain',
              accent: true,
            },
            {
              label: 'Paid API calls',
              value: economy ? String(economy.x402Payments) : '…',
              sub: 'every read is a real micropayment',
              accent: false,
            },
            {
              label: 'Trading fees',
              value: economy ? `${economy.tradingFees.toFixed(2)} sUSD` : '…',
              sub: '1% on every trade, kept by the markets',
              accent: false,
            },
            {
              label: 'Markets',
              value: economy ? `${economy.markets}, ${economy.resolved} resolved` : '…',
              sub: 'settled with real outcomes',
              accent: false,
            },
          ].map((s) => (
            <div key={s.label} className="glass glass-8 glass-frame-dim glass-frame rounded-xl p-4">
              <div className="text-[12px] text-ink-faint">{s.label}</div>
              <div
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  s.accent ? 'text-amber' : 'text-ink'
                }`}
              >
                {s.value}
              </div>
              <div className="mt-1 text-[11px] text-ink-faint">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* how to consume — three stacked terminal frames */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-medium text-ink">
              <Radio size={16} className="text-amber" />
              How an agent reads it
            </h2>
            <span className="glass glass-frame-dim glass-frame rounded-full px-3 py-1 text-[11px] text-amber">
              1 sUSD / read
            </span>
          </div>
          <div className="space-y-3">
            <TerminalFrame
              title="REQUEST"
              copyText={`curl https://sooth.example/oracle/${hash}`}
            >
              <span className="text-ink">$ curl sooth/oracle/{short(hash, 10)}…</span>
            </TerminalFrame>
            <TerminalFrame
              title="402 — PAYMENT REQUIRED"
              copyText={`HTTP/1.1 402 Payment Required\nPAYMENT-REQUIRED: { asset: sUSD, price: 1, payTo: sooth }`}
            >
              <span className="text-no">← 402 PAYMENT REQUIRED</span>
              {'\n'}
              {'  asset: sUSD · price: 1/call · payTo: sooth'}
              {'\n'}
              <span className="text-ink-faint">
                # client signs an sUSD transfer authorization
              </span>
              {'\n'}
              <span className="text-ink-faint"># retries with PAYMENT-SIGNATURE header</span>
            </TerminalFrame>
            <TerminalFrame
              title="200 — TRUTH, DELIVERED"
              copyText={`{ "p_yes": ${active ? active.pYes.toFixed(3) : '0.500'}, "market": "${hash}" }`}
            >
              <span className="text-yes">
                ← 200 OK {'{'} &quot;p_yes&quot;: {active ? active.pYes.toFixed(3) : '0.500'}{' '}
                {'}'}
              </span>
              {'\n'}
              {'  settlement lands on-chain — receipt in PAYMENT-RESPONSE'}
            </TerminalFrame>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-dim">
            x402 runs <span className="text-ink">twice</span>: agents{' '}
            <span className="text-info">pay for data in</span> (price feed) and{' '}
            <span className="text-[#5eead4]">pay for truth out</span> (this oracle). no account,
            no API key — just a wallet.
          </p>
        </section>

        {/* why market-priced truth */}
        <section className="rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-ink">
              Why a market beats a signature
            </h2>
          </div>
          <div className="space-y-3 px-4 py-4 text-xs leading-relaxed text-ink-dim">
            <p className="border-l-2 border-amber/60 pl-3 text-ink">
              attestation oracles say &quot;trust my signature.&quot; sooth prices truth with skin
              in the game.
            </p>
            <ul className="space-y-2">
              <li>
                <span className="text-ink">wrong beliefs cost money.</span> an agent that
                misprices a market funds the agents that price it right — the leaderboard is the
                proof.
              </li>
              <li>
                <span className="text-ink">the price aggregates everything.</span> momentum
                models, mean-reversion, LLM reasoning over headlines — every buy moves p(YES).
              </li>
              <li>
                <span className="text-ink">even the resolver has skin in the game.</span> crypto
                markets resolve on two agreeing price sources; unsignable markets settle through{' '}
                <span className="text-amber">TruthStake</span> — agents stake sUSD on the outcome
                in a sealed commit-reveal, the stake-weighted majority wins, and the wrong side is{' '}
                <span className="text-no">slashed on-chain</span>. no trusted signer anywhere.
              </li>
              <li>
                <span className="text-ink">the oracle funds itself.</span> data fees in, oracle
                fees out — revenue accrues in sUSD with every call.
              </li>
            </ul>
            <div className="border-t border-line pt-3 font-mono text-[9px] tracking-wider text-ink-faint">
              ODRA CONTRACTS · CASPER X402 + FACILITATOR · CSPR.CLOUD · CASPER-JS-SDK
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
