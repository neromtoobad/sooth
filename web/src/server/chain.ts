// dashboard-local chain reader — same CES event strategy as lib/market-reader.ts
// but self-contained so next's bundler only sees npm packages (kept external).
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as casperSdkNs from 'casper-js-sdk';
import * as cesParserNs from '@make-software/ces-js-parser';

/* eslint-disable @typescript-eslint/no-explicit-any */
const casperSdk = ((casperSdkNs as any).default ?? casperSdkNs) as any;
const cesParser = ((cesParserNs as any).default ?? cesParserNs) as any;
const { HttpHandler, RpcClient } = casperSdk;
const { parseSchemasFromBytes, parseEventDataFromBytes } = cesParser;

const NODE_URL = process.env.CASPER_NODE_URL ?? 'https://node.testnet.casper.network/rpc';
export const EXPLORER = 'https://testnet.cspr.live';

let rpcSingleton: any = null;
function rpc() {
  if (!rpcSingleton) {
    const handler = new HttpHandler(NODE_URL);
    if (NODE_URL.includes('cspr.cloud') && process.env.CSPR_CLOUD_API_KEY) {
      handler.setCustomHeaders({ Authorization: process.env.CSPR_CLOUD_API_KEY });
    }
    rpcSingleton = new RpcClient(handler);
  }
  return rpcSingleton;
}

export interface MarketMeta {
  hash: string;
  question: string;
  closeTs: number;
  strike?: number;
  createTx?: string;
}

export interface MarketView extends MarketMeta {
  pYes: number;
  yesPool: string;
  noPool: string;
  resolved: boolean;
  outcome: boolean | null;
  trades: number;
}

const ROOT = join(process.cwd(), '..');

export function loadMarkets(): MarketMeta[] {
  const d = JSON.parse(readFileSync(join(ROOT, 'deployments.json'), 'utf8'));
  return d.markets ?? [];
}

export function loadDeploymentInfo(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, 'deployments.json'), 'utf8'));
}

const contractHashCache = new Map<string, string>();
const schemasCache = new Map<string, unknown>();

// events are immutable — persist them so restarts/reloads never re-backfill
// (the proxy's rate limit punishes cold re-reads hard)
const CACHE_FILE = join(process.cwd(), '.market-events-cache.json');
type CachedEvent = { name: string; data: Record<string, string> };
const eventCache = new Map<string, CachedEvent[]>(
  (() => {
    try {
      return Object.entries(
        JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, CachedEvent[]>,
      );
    } catch {
      return [];
    }
  })(),
);

function persistEventCache() {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(eventCache)));
  } catch {
    /* best effort */
  }
}

async function contractHashOf(pkg: string): Promise<string> {
  const hit = contractHashCache.get(pkg);
  if (hit) return hit;
  const r = await rpc().queryLatestGlobalState(`hash-${pkg}`, []);
  const versions = r.storedValue?.contractPackage?.versions ?? [];
  const last = versions[versions.length - 1];
  if (!last?.contractHash) throw new Error(`no contracts in package ${pkg}`);
  const ch = last.contractHash;
  const hash: string = typeof ch === 'string' ? ch.replace(/^contract-/, '') : (ch.hash?.toHex?.() ?? ch.toHex?.());
  if (!hash) throw new Error('cannot extract contract hash');
  contractHashCache.set(pkg, hash);
  return hash;
}

async function loadSchemas(contractHash: string) {
  if (schemasCache.has(contractHash)) return schemasCache.get(contractHash);
  const r = await rpc().queryLatestGlobalState(`hash-${contractHash}`, ['__events_schema']);
  const hex = r?.rawJSON?.stored_value?.CLValue?.bytes;
  if (!hex) throw new Error('no raw schema bytes');
  const schemas = parseSchemasFromBytes(Buffer.from(hex, 'hex'));
  schemasCache.set(contractHash, schemas);
  return schemas;
}

async function readEvents(pkg: string) {
  const contractHash = await contractHashOf(pkg);
  const cr = await rpc().queryLatestGlobalState(`hash-${contractHash}`, []);
  const nk = cr.storedValue?.contract?.namedKeys?.find((k: any) => k.name === '__events');
  if (!nk) throw new Error('__events missing');
  const seed = nk.key.toString();

  const lr = await rpc().queryLatestGlobalState(`hash-${contractHash}`, ['__events_length']);
  const length: number = lr.storedValue?.clValue?.ui32?.toNumber() ?? 0;

  const cached = eventCache.get(pkg) ?? [];
  if (cached.length >= length) return cached.slice(0, length);

  const schemas: any = await loadSchemas(contractHash);
  const events = [...cached];
  const upTo = Math.min(length, cached.length + 12); // cap catch-up per poll
  // read only the contiguous prefix of successes: a failed read ends this
  // round and is retried on the next poll, so a flaky rpc can never poison
  // the cache with permanently-unparsed entries
  for (let i = cached.length; i < upTo; i++) {
    try {
      const item = await rpc().getDictionaryItem(null, seed, String(i));
      const raw: Uint8Array = item.storedValue.clValue.bytes();
      const payload = raw.slice(4);
      const view = new DataView(payload.buffer, payload.byteOffset);
      const nameLen = view.getUint32(0, true);
      const name = Buffer.from(payload.slice(4, 4 + nameLen))
        .toString('utf8')
        .replace(/^event_/, '');
      const fields = payload.slice(4 + nameLen);
      const schema = schemas[name];
      if (schema) {
        const parsed = parseEventDataFromBytes(schema, fields);
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed ?? {})) data[k] = String(v);
        events.push({ name, data });
      } else {
        events.push({ name: '__unknown_schema', data: {} });
      }
    } catch (e) {
      console.error(`readEvents(${pkg.slice(0, 8)}) stopped at index ${i}:`, String(e).slice(0, 200));
      break; // resume from here next poll
    }
    if (upTo - cached.length > 3) {
      await new Promise((r) => setTimeout(r, 400)); // pace bulk backfill under proxy limits
    }
  }
  if (events.length > cached.length) {
    eventCache.set(pkg, events);
    persistEventCache();
  }
  return events;
}

const FEE_BPS = 100n;
const BPS = 10_000n;

export async function marketView(meta: MarketMeta): Promise<MarketView> {
  let yesPool = 0n;
  let noPool = 0n;
  let pYesNano = 500_000_000;
  let resolved = false;
  let outcome: boolean | null = null;
  let trades = 0;

  try {
    for (const ev of await readEvents(meta.hash)) {
      if (ev.name === 'LiquidityAdded') {
        const amount = BigInt(ev.data.amount ?? '0');
        yesPool += amount;
        noPool += amount;
      } else if (ev.name === 'Trade') {
        trades += 1;
        const amountIn = BigInt(ev.data.amount_in ?? '0');
        const sharesOut = BigInt(ev.data.shares_out ?? '0');
        const net = amountIn - (amountIn * FEE_BPS) / BPS;
        if (ev.data.yes === 'true') {
          noPool += net;
          yesPool = yesPool + net - sharesOut;
        } else {
          yesPool += net;
          noPool = noPool + net - sharesOut;
        }
        pYesNano = Number(BigInt(ev.data.p_yes_nano ?? String(pYesNano)));
      } else if (ev.name === 'Resolved') {
        resolved = true;
        outcome = ev.data.outcome === 'true';
      }
    }
  } catch (e) {
    console.error(`marketView(${meta.hash.slice(0, 8)}) read failed:`, e);
  }

  // rpc gave us nothing usable — synthesize from the agents' activity log,
  // which records every observation, trade and resolution with timestamps
  if (trades === 0) {
    const log = readActivity(2000).filter(
      (e) => e.market === meta.hash || (!e.market && meta === loadMarkets()[0]),
    );
    const lastObs = log.find((e) => typeof e.p_yes === 'number');
    const logTrades = log.filter((e) => e.action === 'buy_yes' || e.action === 'buy_no').length;
    const resolvedEntry = log.find((e) => e.action === 'resolved');
    if (lastObs || resolvedEntry) {
      return {
        ...meta,
        pYes: (lastObs?.p_yes as number) ?? 0.5,
        yesPool: '0',
        noPool: '0',
        resolved: Boolean(resolvedEntry),
        outcome: resolvedEntry ? Boolean((resolvedEntry as { outcome?: boolean }).outcome) : null,
        trades: logTrades,
      };
    }
  }

  return {
    ...meta,
    pYes: pYesNano / 1e9,
    yesPool: yesPool.toString(),
    noPool: noPool.toString(),
    resolved,
    outcome,
    trades,
  };
}

export interface ActivityEntry {
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
  [k: string]: unknown;
}

export function readActivity(limit = 120): ActivityEntry[] {
  try {
    const lines = readFileSync(join(ROOT, 'activity.jsonl'), 'utf8').trim().split('\n');
    return lines
      .slice(-limit)
      .map((l) => {
        try {
          return JSON.parse(l) as ActivityEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is ActivityEntry => x !== null)
      .reverse();
  } catch {
    return [];
  }
}
