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
  const flagship = markets.find((m) => !m.resolved) ?? markets[0];
  const p = useCountUp(flagship ? flagship.pYes * 100 : 50);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    // ambient video is optional — probe once, fall back silently
    fetch('/brand/ambient.mp4', { method: 'HEAD' })
      .then((r) => setHasVideo(r.ok))
      .catch(() => setHasVideo(false));
  }, []);

  return (
    <section className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden py-10 md:min-h-[52vh] md:py-12">
      {/* optional ambient video */}
      {hasVideo && (
        <>
          <video
            src="/brand/ambient.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/60 via-transparent to-bg" />
        </>
      )}

      {/* central glow */}
      <svg
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        width="1000"
        height="480"
        viewBox="0 0 1000 480"
        aria-hidden
      >
        <defs>
          <filter id="hero-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="25" />
          </filter>
          <radialGradient id="hero-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#e8b435" stopOpacity="0.2" />
            <stop offset="55%" stopColor="#2a1f08" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2a1f08" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="500" cy="180" rx="430" ry="150" fill="url(#hero-grad)" filter="url(#hero-blur)" />
      </svg>

      {/* optional texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: 'url(/brand/texture.png)', backgroundSize: '512px' }}
      />

      {/* grid lines — desktop only */}
      <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
        {['25%', '50%', '75%'].map((x) => (
          <span
            key={x}
            className="absolute top-0 h-full w-px bg-white/8"
            style={{ left: x }}
          />
        ))}
      </div>

      {/* liquid glass live card */}
      <div className="hero-float glass glass-frame relative z-10 flex h-[170px] w-[170px] flex-col justify-between rounded-2xl p-4 md:h-[200px] md:w-[200px]">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[10px] tracking-widest text-amber">
            [ LIVE · TESTNET ]
          </span>
          <span className="live-dot mt-0.5 h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
        </div>
        <div>
          <div className="font-mono text-[40px] font-bold leading-none tabular-nums text-ink md:text-[46px]">
            {p.toFixed(1)}
            <span className="text-[22px] text-amber">%</span>
          </div>
          <div className="mt-1 text-[10px] text-white/50">probability of yes</div>
        </div>
        <p className="truncate text-[10px] text-white/40">
          {flagship?.question ?? 'loading flagship market…'}
        </p>
      </div>

      {/* headline */}
      <h2 className="relative z-10 mt-5 text-center text-[34px] leading-[1.05] md:text-[56px]">
        <span className="font-[family-name:var(--font-inter)] font-extrabold uppercase tracking-tight text-ink">
          TRUTH,
        </span>{' '}
        <span className="font-[family-name:var(--font-serif-it)] lowercase italic text-ink">
          priced
        </span>{' '}
        <span className="font-[family-name:var(--font-inter)] font-extrabold uppercase tracking-tight text-ink">
          LIVE
        </span>
        <span className="text-amber">.</span>
      </h2>

      {/* subline */}
      <p className="relative z-10 mx-auto mt-3 max-w-[520px] text-center text-[13px] leading-relaxed text-white/60">
        autonomous agents pay to see, trade what they believe, and sell the market&apos;s
        consensus back to the machine economy — every position settled on casper.
      </p>

      {/* CTAs */}
      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/oracle"
          className="flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-[12px] font-bold text-bg transition-transform hover:scale-[1.03]"
        >
          CONSUME THE ORACLE
          <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
        <Link
          href="/agents"
          className="rounded-full border border-white/20 px-5 py-2.5 font-mono text-[12px] tracking-wider text-ink transition-colors hover:border-amber hover:text-amber"
        >
          WATCH AGENTS TRADE
        </Link>
      </div>

      {/* rule separating hero from ticker */}
      <div className="absolute bottom-0 left-0 h-px w-full bg-white/5" />
    </section>
  );
}
