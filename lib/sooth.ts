// sooth.ts — typed client over casper-js-sdk v5 for the sooth contracts.
// interface is final; transaction plumbing lands in phase 2 (see docs/CASPER_JS_NOTES.md).
import { readFileSync } from 'fs';
import { join } from 'path';

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
  markets: { hash: string; question: string; closeTs: number }[];
}

export function loadDeployments(): Deployments {
  return JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'deployments.json'), 'utf8'),
  );
}

const NANO = 1_000_000_000n;

/** sUSD nano units → display number */
export function fromNano(v: bigint): number {
  return Number(v) / Number(NANO);
}

export function toNano(v: number): bigint {
  return BigInt(Math.round(v * Number(NANO)));
}

export class SoothClient {
  private constructor(
    public readonly publicKeyHex: string,
    private readonly pemPath: string,
  ) {}

  static async connect(pemPath: string): Promise<SoothClient> {
    const { PrivateKey, KeyAlgorithm } = await import('casper-js-sdk');
    const key = PrivateKey.fromPem(readFileSync(pemPath, 'utf8'), KeyAlgorithm.ED25519);
    return new SoothClient(key.publicKey.toHex(), pemPath);
  }

  // ── writes (phase 2: ContractCallBuilder + RPC submit) ──────────

  async mint(_to: string, _amount: bigint): Promise<string> {
    throw new Error('phase 2: not wired yet');
  }

  async approve(_spender: string, _amount: bigint): Promise<string> {
    throw new Error('phase 2: not wired yet');
  }

  async buyYes(_marketHash: string, _amount: bigint): Promise<string> {
    throw new Error('phase 2: not wired yet');
  }

  async buyNo(_marketHash: string, _amount: bigint): Promise<string> {
    throw new Error('phase 2: not wired yet');
  }

  async resolve(_marketHash: string, _outcome: boolean): Promise<string> {
    throw new Error('phase 2: not wired yet');
  }

  async claim(_marketHash: string): Promise<string> {
    throw new Error('phase 2: not wired yet');
  }

  // ── reads (phase 2: CSPR.cloud REST / node queries) ─────────────

  async priceYes(_marketHash: string): Promise<number> {
    throw new Error('phase 2: not wired yet');
  }

  async marketInfo(_marketHash: string): Promise<MarketState> {
    throw new Error('phase 2: not wired yet');
  }

  async listMarkets(): Promise<string[]> {
    return loadDeployments().markets.map((m) => m.hash);
  }
}
