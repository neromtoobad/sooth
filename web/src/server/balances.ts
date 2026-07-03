// balance lookups with last-good fallback: native CSPR via public RPC,
// sUSD via cspr.cloud's indexed FT ownership (quota-limited — cached hard)
import { readFileSync } from 'fs';
import { join } from 'path';
import * as casperSdkNs from 'casper-js-sdk';

/* eslint-disable @typescript-eslint/no-explicit-any */
const casperSdk = ((casperSdkNs as any).default ?? casperSdkNs) as any;
const { HttpHandler, RpcClient, PublicKey, PurseIdentifier } = casperSdk;

const NODE_URL = process.env.CASPER_NODE_URL ?? 'https://node.testnet.casper.network/rpc';
let rpcSingleton: any = null;
function rpc() {
  if (!rpcSingleton) rpcSingleton = new RpcClient(new HttpHandler(NODE_URL));
  return rpcSingleton;
}

export interface AgentBalance {
  susd: number | null;
  cspr: number | null;
}

const lastGood = new Map<string, AgentBalance>();

function susdPackageHash(): string {
  const d = JSON.parse(
    readFileSync(join(process.cwd(), '..', 'deployments.json'), 'utf8'),
  );
  return String(d.susdPackageHash).replace(/^hash-/, '');
}

export async function agentBalances(
  agents: { name: string; publicKey: string; accountHash: string }[],
): Promise<Map<string, AgentBalance>> {
  const susdPkg = susdPackageHash();
  const apiKey = process.env.CSPR_CLOUD_API_KEY;
  const out = new Map<string, AgentBalance>();

  for (const a of agents) {
    const prev = lastGood.get(a.name) ?? { susd: null, cspr: null };
    let cspr: number | null = prev.cspr;
    let susd: number | null = prev.susd;

    try {
      const r = await rpc().queryLatestBalance(
        PurseIdentifier.fromPublicKey(PublicKey.fromHex(a.publicKey)),
      );
      cspr = Number(BigInt(r.balance.toString()) / 1_000_000n) / 1000;
    } catch {
      /* keep last */
    }

    if (apiKey) {
      try {
        const owner = a.accountHash.replace('account-hash-', '');
        const res = await fetch(
          `https://api.testnet.cspr.cloud/accounts/${owner}/ft-token-ownership`,
          { headers: { Authorization: apiKey } },
        );
        if (res.ok) {
          const body = (await res.json()) as {
            data: { balance: string; contract_package_hash: string }[];
          };
          const entry = body.data.find((t) => t.contract_package_hash === susdPkg);
          susd = entry ? Number(BigInt(entry.balance) / 1_000_000n) / 1000 : 0;
        }
      } catch {
        /* keep last */
      }
    }

    const bal = { susd, cspr };
    if (susd != null || cspr != null) lastGood.set(a.name, bal);
    out.set(a.name, bal);
  }
  return out;
}
