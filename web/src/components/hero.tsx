'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useJson, type Market } from '@/lib/shared';

/** 300ms count-up tween toward the target value */
function useCountUp(target: number, ms = 300): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min((t - start) / ms, 1);
      setDisplay(from + (target - from) * k);
      if (k < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return display;
}

export function Hero() {
  const markets = useJson<Market[]>('/api/markets', 10_000, []);
  // flagship = the unsignable market if one is open, else any open market
  const flagship =
    markets.find((m) => m.kind === 'subjective' && !m.resolved) ??
    markets.find((m) => !m.resolved) ??
    markets[0];
  const isSubjective = flagship?.kind === 'subjective';
  const p = useCountUp(flagship ? flagship.pYes * 100 : 50);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    // ambient video is optional — probe once, fall back silently
    fetch('/brand/ambient.mp4', { method: 'HEAD' })
      .then((r) => setHasVideo(r.ok))
      .catch(() => setHasVideo(false));
  }, []);

  return (
    <section className="relative overflow-hidden pt-8 pb-6">
      {/* optional ambient video, kept subtle behind the header */}
      {hasVideo && (
        <>
          <video
            src="/brand/ambient.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/40 via-transparent to-bg" />
        </>
      )}

      {/* soft amber glow, anchored to the right where the card sits */}
      <div className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full bg-amber/10 blur-3xl" />

      <div className="relative z-10 flex flex-col-reverse items-start gap-8 md:flex-row md:items-center md:justify-between">
        {/* text block */}
        <div className="max-w-xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
            Overview
          </div>
          <h1 className="mt-3 text-[38px] leading-[1.02] md:text-[52px]">
            <span className="font-[family-name:var(--font-inter)] font-extrabold uppercase tracking-tight text-ink">
              TRUTH,
            </span>{' '}
            <span className="font-[family-name:var(--font-serif-it)] lowercase italic text-ink-dim">
              priced
            </span>{' '}
            <span className="font-[family-name:var(--font-inter)] font-extrabold uppercase tracking-tight text-ink">
              LIVE
            </span>
            <span className="text-amber">.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-ink-dim">
            Attestation oracles can only sign what already has a source. SOOTH prices the truth that{' '}
            <span className="text-ink">has none</span> — autonomous agents pay to see, trade what
            they believe, and sell the market&apos;s consensus back to the machine economy. Every
            position settles on Casper.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/oracle"
              className="flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-[12px] font-bold text-bg transition-transform hover:scale-[1.03]"
            >
              Consume the oracle
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
            <Link
              href="/agents"
              className="rounded-full border border-line-strong px-5 py-2.5 font-mono text-[12px] tracking-wider text-ink transition-colors hover:border-amber hover:text-amber"
            >
              Watch agents trade
            </Link>
          </div>
        </div>

        {/* live probability card */}
        <div className="glass glass-frame relative flex h-[180px] w-[180px] shrink-0 flex-col justify-between rounded-2xl p-4 md:h-[200px] md:w-[200px]">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[10px] tracking-widest text-amber">
              {isSubjective ? '[ UNSIGNABLE ]' : '[ LIVE · TESTNET ]'}
            </span>
            <span className="live-dot mt-0.5 h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
          </div>
          <div>
            <div className="font-mono text-[42px] font-bold leading-none tabular-nums text-ink md:text-[48px]">
              {p.toFixed(1)}
              <span className="text-[22px] text-amber">%</span>
            </div>
            <div className="mt-1 text-[10px] text-ink-dim">
              {isSubjective ? "the crowd's belief" : 'probability of yes'}
            </div>
          </div>
          <p className="line-clamp-2 text-[10px] leading-snug text-ink-faint">
            {flagship?.question ?? 'loading flagship market…'}
          </p>
        </div>
      </div>
    </section>
  );
}
