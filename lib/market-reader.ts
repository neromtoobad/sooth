// reads BinaryMarket state straight from chain via the CES event log:
// __events_length + __events dictionary + __events_schema, parsed with
// @make-software/ces-js-parser. no indexer dependency; works on any node.
import { rpc } from './casper.ts';

interface ParsedEvent {
  name: string;
  data: Record<string, unknown>;
}

export interface MarketOnChainState {
  pYesNano: number;
  yesPool: bigint;
  noPool: bigint;
  resolved: boolean;
  outcome: boolean | null;
  trades: number;
}

const contractHashCache = new Map<string, string>();
const schemasCache = new Map<string, unknown>();
// events are append-only and immutable — cache parsed ones per package
const eventCache = new Map<string, ParsedEvent[]>();

/** latest contract hash inside a package (cspr.cloud if key present, else RPC) */
export async function contractHashOf(packageHash: string): Promise<string> {
  const pkg = packageHash.replace(/^hash-/, '');
  const hit = contractHashCache.get(pkg);
  if (hit) return hit;

  const apiKey = process.env.CSPR_CLOUD_API_KEY;
  if (apiKey) {
    const res = await fetch(
      `https://api.testnet.cspr.cloud/contract-packages/${pkg}/contracts`,
      { headers: { Authorization: apiKey } },
    );
    if (res.ok) {
      const body = (await res.json()) as { data: { contract_hash: string; contract_version: number }[] };
      const latest = body.data.sort((a, b) => b.contract_version - a.contract_version)[0];
      if (latest) {
        contractHashCache.set(pkg, latest.contract_hash);
        return latest.contract_hash;
      }
    }
  }

  // rpc fallback: contract package stored value lists versions
  const r = await rpc().queryLatestGlobalState(`hash-${pkg}`, []);
  const sv = r.storedValue as unknown as {
    contractPackage?: { versions?: { contractHash?: { toHex(): string } }[] };
  };
  const versions = sv.contractPackage?.versions ?? [];
  const last = versions[versions.length - 1];
  if (!last?.contractHash) throw new Error(`no contract versions in package ${pkg}`);
  const hash = last.contractHash.toHex();
  contractHashCache.set(pkg, hash);
  return hash;
}

async function eventsSeedUref(contractHash: string): Promise<string> {
  const r = await rpc().queryLatestGlobalState(`hash-${contractHash}`, []);
  const sv = r.storedValue as unknown as {
    contract?: { namedKeys?: { name: string; key: { toString(): string } }[] };
  };
  const nk = sv.contract?.namedKeys?.find((k) => k.name === '__events');
  if (!nk) throw new Error(`__events named key missing on ${contractHash}`);
  return nk.key.toString();
}

async function eventsLength(contractHash: string): Promise<number> {
  const r = await rpc().queryLatestGlobalState(`hash-${contractHash}`, ['__events_length']);
  const cl = (r.storedValue as unknown as { clValue?: { ui32?: { toNumber(): number } } }).clValue;
  const n = cl?.ui32?.toNumber();
  if (n == null) throw new Error('could not read __events_length');
  return n;
}

async function loadSchemas(contractHash: string) {
  if (schemasCache.has(contractHash)) return schemasCache.get(contractHash);
  const cesMod = (await import('@make-software/ces-js-parser')) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { parseSchemasFromBytes } = (cesMod.default ?? cesMod) as any;
  // schema must come from the raw JSON hex — the SDK's re-parsed CLValue
  // drops entries when round-tripped through bytes()
  const r = await rpc().queryLatestGlobalState(`hash-${contractHash}`, ['__events_schema']);
  const hex = (r as unknown as { rawJSON?: { stored_value?: { CLValue?: { bytes?: string } } } })
    .rawJSON?.stored_value?.CLValue?.bytes;
  if (!hex) throw new Error('no raw schema bytes');
  const schemas = parseSchemasFromBytes(Buffer.from(hex, 'hex'));
  schemasCache.set(contractHash, schemas);
  return schemas;
}

async function readEvents(packageHash: string, maxBack = 200): Promise<ParsedEvent[]> {
  const contractHash = await contractHashOf(packageHash);
  const [seed, length, schemas] = await Promise.all([
    eventsSeedUref(contractHash),
    eventsLength(contractHash),
    loadSchemas(contractHash),
  ]);
  const cesMod2 = (await import('@make-software/ces-js-parser')) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { parseEventDataFromBytes } = (cesMod2.default ?? cesMod2) as any;

  const cached = eventCache.get(packageHash) ?? [];
  if (cached.length >= length) return cached.slice(0, length);

  const from = Math.max(cached.length, length - maxBack);
  const events: ParsedEvent[] = [...cached];
  for (let i = from; i < length; i++) {
    const item = await rpc().getDictionaryItem(null, seed, String(i));
    const cl = item.storedValue.clValue as unknown as { bytes?(): Uint8Array };
    const raw = cl?.bytes?.();
    if (!raw || raw.length < 8) {
      events.push({ name: '__unparsed', data: {} });
      continue;
    }
    try {
      // raw = u32 payload-len + payload; payload = u32 name-len + "event_X" + fields
      const payload = raw.slice(4);
      const view = new DataView(payload.buffer, payload.byteOffset);
      const nameLen = view.getUint32(0, true);
      const name = Buffer.from(payload.slice(4, 4 + nameLen))
        .toString('utf8')
        .replace(/^event_/, '');
      const fields = payload.slice(4 + nameLen);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = (schemas as any)[name];
      if (!schema) {
        events.push({ name: '__unparsed', data: {} });
        continue;
      }
      const parsedData = parseEventDataFromBytes(schema, fields);
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsedData ?? {})) {
        data[k] = String(v);
      }
      events.push({ name, data });
    } catch {
      events.push({ name: '__unparsed', data: {} }); // keep index alignment
    }
  }
  eventCache.set(packageHash, events);
  return events;
}

export async function readMarketOnChain(packageHash: string): Promise<MarketOnChainState> {
  const events = await readEvents(packageHash);
  const FEE_BPS = 100n;
  const BPS = 10_000n;

  let yesPool = 0n;
  let noPool = 0n;
  let pYesNano = 500_000_000;
  let resolved = false;
  let outcome: boolean | null = null;
  let trades = 0;

  for (const ev of events) {
    if (ev.name === 'LiquidityAdded') {
      const amount = BigInt(String(ev.data.amount ?? '0'));
      yesPool += amount;
      noPool += amount;
    } else if (ev.name === 'Trade') {
      trades += 1;
      const amountIn = BigInt(String(ev.data.amount_in ?? '0'));
      const sharesOut = BigInt(String(ev.data.shares_out ?? '0'));
      const isYes = String(ev.data.yes) === 'true';
      const net = amountIn - (amountIn * FEE_BPS) / BPS;
      if (isYes) {
        noPool += net;
        yesPool = yesPool + net - sharesOut;
      } else {
        yesPool += net;
        noPool = noPool + net - sharesOut;
      }
      pYesNano = Number(BigInt(String(ev.data.p_yes_nano ?? pYesNano)));
    } else if (ev.name === 'Resolved') {
      resolved = true;
      outcome = String(ev.data.outcome) === 'true';
    }
  }

  return { pYesNano, yesPool, noPool, resolved, outcome, trades };
}
