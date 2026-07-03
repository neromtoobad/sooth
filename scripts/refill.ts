// transfer native CSPR from deployer to an agent: pnpm tsx scripts/refill.ts <agent> <cspr>
import { readFileSync } from 'fs';
import { join } from 'path';
import { NativeTransferBuilder, PublicKey } from '../lib/sdk.ts';
import { CHAIN_NAME, EXPLORER, loadKey, rpc } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));
const [agent, amountRaw] = process.argv.slice(2);
const amount = BigInt(Number(amountRaw ?? 100)) * 1_000_000_000n;

const deployer = loadKey(join(ROOT, 'keys', 'deployer.pem'));
const tx = new NativeTransferBuilder()
  .from(deployer.publicKey)
  .target(PublicKey.fromHex(accounts[agent].publicKey))
  .amount(amount.toString())
  .id(1)
  .chainName(CHAIN_NAME)
  .payment(100_000_000)
  .build();
tx.sign(deployer);
const res = await rpc().putTransaction(tx);
console.log(`deployer -> ${agent} ${amountRaw} CSPR: ${EXPLORER}/transaction/${(res.transactionHash.transactionV1 ?? res.transactionHash.deploy ?? res.transactionHash).toHex()}`);
await rpc().waitForTransaction(tx, 120_000);
console.log('confirmed');
