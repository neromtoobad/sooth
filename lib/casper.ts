// low-level casper helpers shared by sooth.ts and the deploy scripts
// see docs/CASPER_JS_NOTES.md for the API references behind all of this
import { readFileSync } from 'fs';
import {
  AccountIdentifier,
  Args,
  ContractCallBuilder,
  HttpHandler,
  KeyAlgorithm,
  PrivateKey,
  RpcClient,
  SessionBuilder,
  type PrivateKeyT,
  type Transaction,
} from './sdk.ts';

export const CHAIN_NAME = 'casper-test';
export const NODE_URL =
  process.env.CASPER_NODE_URL ?? 'https://node.testnet.casper.network/rpc';
export const EXPLORER = 'https://testnet.cspr.live';

let rpcSingleton: InstanceType<typeof RpcClient> | null = null;

export function rpc(): InstanceType<typeof RpcClient> {
  if (!rpcSingleton) {
    const handler = new HttpHandler(NODE_URL);
    if (NODE_URL.includes('cspr.cloud') && process.env.CSPR_CLOUD_API_KEY) {
      handler.setCustomHeaders({ Authorization: process.env.CSPR_CLOUD_API_KEY });
    }
    rpcSingleton = new RpcClient(handler);
  }
  return rpcSingleton;
}

export function loadKey(pemPath: string): PrivateKeyT {
  return PrivateKey.fromPem(readFileSync(pemPath, 'utf8'), KeyAlgorithm.ED25519);
}

export interface TxOutcome {
  txHash: string;
  explorerLink: string;
}

async function submitAndWait(tx: Transaction, timeoutMs: number): Promise<TxOutcome> {
  const put = await rpc().putTransaction(tx);
  const txHash = (put.transactionHash.transactionV1 ?? put.transactionHash.deploy ?? put.transactionHash).toHex();
  const result = await rpc().waitForTransaction(tx, timeoutMs);
  const errMsg = result.executionInfo?.executionResult?.errorMessage;
  if (errMsg) {
    throw new Error(`tx ${txHash} reverted: ${errMsg}`);
  }
  return { txHash, explorerLink: `${EXPLORER}/transaction/${txHash}` };
}

/** call an entry point on a contract package */
export async function callContract(opts: {
  signer: PrivateKeyT;
  packageHash: string; // bare 64-hex
  entryPoint: string;
  args: InstanceType<typeof Args>;
  paymentMotes?: number;
  timeoutMs?: number;
}): Promise<TxOutcome> {
  const tx = new ContractCallBuilder()
    .from(opts.signer.publicKey)
    .byPackageHash(opts.packageHash.replace(/^hash-/, ''))
    .entryPoint(opts.entryPoint)
    .runtimeArgs(opts.args)
    .chainName(CHAIN_NAME)
    .payment(opts.paymentMotes ?? 5_000_000_000)
    .build();
  tx.sign(opts.signer);
  return submitAndWait(tx, opts.timeoutMs ?? 120_000);
}

/** install a wasm (odra contracts need their odra_cfg_* args included) */
export async function installWasm(opts: {
  signer: PrivateKeyT;
  wasmPath: string;
  args: InstanceType<typeof Args>;
  paymentMotes?: number;
  timeoutMs?: number;
}): Promise<TxOutcome> {
  const wasm = new Uint8Array(readFileSync(opts.wasmPath));
  const tx = new SessionBuilder()
    .from(opts.signer.publicKey)
    .wasm(wasm)
    .installOrUpgrade()
    .runtimeArgs(opts.args)
    .chainName(CHAIN_NAME)
    .payment(opts.paymentMotes ?? 300_000_000_000)
    .build();
  tx.sign(opts.signer);
  return submitAndWait(tx, opts.timeoutMs ?? 240_000);
}

/** package hash recorded under the deployer account's named keys after install */
export async function namedKeyPackageHash(
  signer: PrivateKeyT,
  keyName: string,
): Promise<string> {
  const acct = await rpc().getAccountInfo(
    null,
    new AccountIdentifier(undefined, signer.publicKey),
  );
  const nk = acct.account.namedKeys.find((k) => k.name === keyName);
  if (!nk) {
    throw new Error(
      `named key ${keyName} not found on deployer account — install may have failed`,
    );
  }
  return nk.key.toString().replace(/^(hash-|package-)/, '');
}
