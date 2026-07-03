import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { readActivity } from '@/server/chain';
import { agentBalances } from '@/server/balances';

export const dynamic = 'force-dynamic';

const TRADERS = ['momo', 'meanie', 'vibes', 'bull', 'bear'] as const;
const STARTING_SUSD: Record<string, number> = {
  momo: 200,
  meanie: 200,
  vibes: 200,
  bull: 150,
  bear: 150,
};
const X402_PRICE = 0.5;

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

let cache: { at: number; data: AgentRow[] } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 45_000) return NextResponse.json(cache.data);

  const accounts = JSON.parse(
    readFileSync(join(process.cwd(), '..', 'keys', 'accounts.json'), 'utf8'),
  ) as Record<string, { publicKey: string; accountHash: string }>;
  const activity = readActivity(4000);
  const balances = await agentBalances(
    TRADERS.map((n) => ({ name: n, publicKey: accounts[n].publicKey, accountHash: accounts[n].accountHash })),
  );

  const rows: AgentRow[] = TRADERS.map((name) => {
    const mine = activity.filter((a) => a.agent === name);
    const trades = mine.filter((a) => a.action === 'buy_yes' || a.action === 'buy_no').length;
    const payments = mine.filter((a) => a.x402_payment).length;
    const lastDecision = mine.find(
      (a) => a.action === 'buy_yes' || a.action === 'buy_no' || a.action === 'hold',
    );
    const bal = balances.get(name);
    return {
      name,
      kind: name === 'momo' || name === 'meanie' ? 'heuristic' : 'llm',
      susd: bal?.susd ?? null,
      pnl: bal?.susd != null ? bal.susd - STARTING_SUSD[name] : null,
      cspr: bal?.cspr ?? null,
      trades,
      dataSpend: payments * X402_PRICE,
      lastThesis: (lastDecision?.thesis as string) ?? (lastDecision?.signal as string) ?? null,
      lastAction: lastDecision?.action ?? null,
      lastTs: lastDecision?.ts ?? null,
    };
  });

  cache = { at: Date.now(), data: rows };
  return NextResponse.json(rows);
}
