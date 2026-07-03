'use client';

import { useCallback, useEffect, useState } from 'react';

export const EXPLORER = 'https://testnet.cspr.live';

export interface Market {
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

export interface Activity {
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
  confidence?: number;
  error?: string;
}

export interface PricePoint {
  ts: number;
  p: number;
}

export interface AgentRow {
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

export interface Economy {
  x402Revenue: number;
  x402Payments: number;
  tradingFees: number;
  markets: number;
  resolved: number;
}

export function useJson<T>(url: string | null, intervalMs: number, initial: T): T {
  const [data, setData] = useState<T>(initial);
  const tick = useCallback(async () => {
    if (!url) return;
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

export function countdown(closeTs: number): string {
  const ms = closeTs - Date.now();
  if (ms <= 0) return 'CLOSED';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}D ${h % 24}H`;
  return `${h}H ${m.toString().padStart(2, '0')}M`;
}

export function short(hash: string, n = 8): string {
  return hash.slice(0, n);
}

export const AGENT_COLORS: Record<string, string> = {
  momo: 'text-amber',
  meanie: 'text-[#d16a5a]',
  vibes: 'text-[#9a7bff]',
  bull: 'text-yes',
  bear: 'text-no',
  resolver: 'text-ink',
  consumer: 'text-[#5eead4]',
  deployer: 'text-ink-dim',
};

export function actionLabel(a: Activity): { text: string; cls: string } {
  if (a.action === 'buy_yes')
    return { text: `BUY YES ${a.size?.toFixed(2)} sUSD`, cls: 'text-yes' };
  if (a.action === 'buy_no') return { text: `BUY NO ${a.size?.toFixed(2)} sUSD`, cls: 'text-no' };
  if (a.action === 'hold') return { text: 'HOLD', cls: 'text-ink-faint' };
  if (a.action === 'oracle_read') return { text: 'ORACLE READ', cls: 'text-[#5eead4]' };
  if (a.action === 'resolving' || a.action === 'resolved')
    return { text: a.action.toUpperCase(), cls: 'text-amber' };
  if (a.action === 'claimed') return { text: 'CLAIMED', cls: 'text-yes' };
  if (a.action === 'error') return { text: 'ERR', cls: 'text-no/70' };
  return { text: a.action.toUpperCase(), cls: 'text-ink-dim' };
}
