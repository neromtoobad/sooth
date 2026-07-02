// sooth.ts — typed client over casper-js-sdk v5 for the sooth contracts.
// writes: real txs against the public testnet node (docs/CASPER_JS_NOTES.md).
// reads: CSPR.cloud indexed data + on-chain named keys; market-state read
// strategy is finalized after the first testnet deploy (odra storage layout
// is inspected then — see readMarketState below).
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PrivateKeyT } from './sdk.ts';
import { callContract, loadKey, rpc, type TxOutcome } from './casper.ts';

export interface MarketState {
  marketHash: string;
  question: string;
  closeTs: number; // ms
  pYes: number; // 0..1
  yesPool: bigint;
  noPool: bigint;
  resolved: boolean;
  outcome: boolean | null;
}

export interface Deployments {
  network: string;
  susdPackageHash: string;
  factoryPackageHash: string;
  markets: { hash: string; question: string; closeTs: number; strike?: number }[];
}

const DEPLOYMENTS_PATH = join(import.meta.dirname, '..', 'deployments.json');

export function loadDeployments(): Deployments {
  if (!existsSync(DEPLOYMENTS_PATH)) {
    throw new Error('deployments.json not found — run phase 2 deploy first');
  }
  return JSON.parse(readFileSync(DEPLOYMENTS_PATH, 'utf8'));
}

const NANO = 1_000_000_000n;

export function fromNano(v: bigint): number {
  return Number(v) / Number(NANO);
}

export function toNano(v: number): bigint {
  return BigInt(Math.round(v * Number(NANO)));
}

async function u256(v: bigint) {
  const { CLValue } = await import('./sdk.ts');
  return CLValue.newCLUInt256(v.toString());
}

async function accountKey(accountHashPrefixed: string) {
  const { CLValue, Key } = await import('./sdk.ts');
  return CLValue.newCLKey(Key.newKey(accountHashPrefixed));
}

async function packageKey(packageHash: string) {
  const { CLValue, Key } = await import('./sdk.ts');
  return CLValue.newCLKey(Key.newKey(`hash-${packageHash.replace(/^hash-/, '')}`));
}

export class SoothClient {
  private constructor(
    public readonly publicKeyHex: string,
    public readonly accountHash: string, // prefixed form
    private readonly key: PrivateKeyT,
  ) {}

  static async connect(pemPath: string): Promise<SoothClient> {
    const key = loadKey(pemPath);
    return new SoothClient(
      key.publicKey.toHex(),
      key.publicKey.accountHash().toPrefixedString(),
      key,
    );
  }

  // ── sUSD (CEP-18) ────────────────────────────────────────────────

  /** transfer sUSD (deployer holds initial supply — this is the faucet) */
  async transferSusd(toAccountHash: string, amount: bigint): Promise<string> {
    const { Args } = await import('./sdk.ts');
    const out = await callContract({
      signer: this.key,
      packageHash: loadDeployments().susdPackageHash,
      entryPoint: 'transfer',
      args: Args.fromMap({
        recipient: await accountKey(toAccountHash),
        amount: await u256(amount),
      }),
    });
    return out.txHash;
  }

  /** approve a market to pull sUSD collateral */
  async approve(spenderPackageHash: string, amount: bigint): Promise<string> {
    const { Args } = await import('./sdk.ts');
    const out = await callContract({
      signer: this.key,
      packageHash: loadDeployments().susdPackageHash,
      entryPoint: 'approve',
      args: Args.fromMap({
        spender: await packageKey(spenderPackageHash),
        amount: await u256(amount),
      }),
    });
    return out.txHash;
  }

  /** sUSD balance via CSPR.cloud indexed FT ownership (no dictionary math) */
  async susdBalance(accountHash?: string): Promise<bigint> {
    const owner = (accountHash ?? this.accountHash).replace('account-hash-', '');
    const apiKey = process.env.CSPR_CLOUD_API_KEY;
    if (!apiKey) throw new Error('CSPR_CLOUD_API_KEY required for balance reads');
    const res = await fetch(
      `https://api.testnet.cspr.cloud/accounts/${owner}/ft-token-ownership`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) throw new Error(`cspr.cloud ${res.status}`);
    const body = (await res.json()) as {
      data: { balance: string; contract_package_hash: string }[];
    };
    const susd = loadDeployments().susdPackageHash.replace(/^hash-/, '');
    const entry = body.data.find((t) => t.contract_package_hash === susd);
    return entry ? BigInt(entry.balance) : 0n;
  }

  // ── market writes ────────────────────────────────────────────────

  async addLiquidity(marketHash: string, amount: bigint): Promise<string> {
    return this.marketCall(marketHash, 'add_liquidity', { amount: await u256(amount) });
  }

  async buyYes(marketHash: string, amountIn: bigint): Promise<string> {
    return this.marketCall(marketHash, 'buy_yes', { amount_in: await u256(amountIn) });
  }

  async buyNo(marketHash: string, amountIn: bigint): Promise<string> {
    return this.marketCall(marketHash, 'buy_no', { amount_in: await u256(amountIn) });
  }

  async resolve(marketHash: string, outcome: boolean): Promise<string> {
    const { CLValue } = await import('./sdk.ts');
    return this.marketCall(marketHash, 'resolve', {
      outcome: CLValue.newCLValueBool(outcome),
    });
  }

  async claim(marketHash: string): Promise<string> {
    return this.marketCall(marketHash, 'claim', {});
  }

  async createMarket(question: string, closeTs: number, resolverAccountHash: string): Promise<string> {
    const { Args, CLValue } = await import('./sdk.ts');
    const out = await callContract({
      signer: this.key,
      packageHash: loadDeployments().factoryPackageHash,
      entryPoint: 'create_market',
      args: Args.fromMap({
        question: CLValue.newCLString(question),
        close_ts: CLValue.newCLUint64(closeTs),
        resolver: await accountKey(resolverAccountHash),
      }),
      paymentMotes: 700_000_000_000, // market creation deploys a full child contract (~install cost)
      timeoutMs: 240_000,
    });
    return out.txHash;
  }

  // ── reads ────────────────────────────────────────────────────────

  async priceYes(marketHash: string): Promise<number> {
    const info = await this.marketInfo(marketHash);
    return info.pYes;
  }

  async marketInfo(marketHash: string): Promise<MarketState> {
    const meta = loadDeployments().markets.find((m) => m.hash === marketHash);
    const state = await readMarketState(marketHash);
    return {
      marketHash,
      question: meta?.question ?? state.question ?? 'unknown',
      closeTs: meta?.closeTs ?? state.closeTs ?? 0,
      pYes: state.pYes,
      yesPool: state.yesPool,
      noPool: state.noPool,
      resolved: state.resolved,
      outcome: state.outcome,
    };
  }

  async listMarkets(): Promise<string[]> {
    return loadDeployments().markets.map((m) => m.hash);
  }

  // ── internals ────────────────────────────────────────────────────

  private async marketCall(
    marketHash: string,
    entryPoint: string,
    argMap: Record<string, unknown>,
  ): Promise<string> {
    const { Args } = await import('./sdk.ts');
    const out: TxOutcome = await callContract({
      signer: this.key,
      packageHash: marketHash,
      entryPoint,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: Args.fromMap(argMap as any),
    });
    return out.txHash;
  }
}

// ── market state reading ───────────────────────────────────────────
// odra stores module state in its own dictionary layout; the exact key
// derivation is confirmed by inspecting the deployed contract on
// testnet.cspr.live (BUILD_GUIDE P2.1). until then we read through the
// CES events that our contracts emit (Trade carries p_yes_nano, and
// LiquidityAdded/Resolved bracket the lifecycle), indexed by CSPR.cloud.

interface RawMarketState {
  question: string | null;
  closeTs: number | null;
  pYes: number;
  yesPool: bigint;
  noPool: bigint;
  resolved: boolean;
  outcome: boolean | null;
}

export async function readMarketState(marketHash: string): Promise<RawMarketState> {
  const { readMarketOnChain } = await import('./market-reader.ts');
  const s = await readMarketOnChain(marketHash);
  return {
    question: null,
    closeTs: null,
    pYes: s.pYesNano / 1_000_000_000,
    yesPool: s.yesPool,
    noPool: s.noPool,
    resolved: s.resolved,
    outcome: s.outcome,
  };
}
