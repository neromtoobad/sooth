// send native CSPR between agent keys: pnpm tsx scripts/send-cspr.ts <from> <to> <cspr>
import { readFileSync } from 'fs';
import { join } from 'path';
import { NativeTransferBuilder, PublicKey } from '../lib/sdk.ts';
import { CHAIN_NAME, loadKey, rpc } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));
const [from, to, amountRaw] = process.argv.slice(2);
const signer = loadKey(join(ROOT, 'keys', `${from}.pem`));
const tx = new NativeTransferBuilder()
  .from(signer.publicKey)
  .target(PublicKey.fromHex(accounts[to].publicKey))
  .amount((BigInt(Number(amountRaw)) * 1_000_000_000n).toString())
  .id(2)
  .chainName(CHAIN_NAME)
  .payment(100_000_000)
  .build();
tx.sign(signer);
await rpc().putTransaction(tx);
await rpc().waitForTransaction(tx, 120_000);
console.log(`${from} -> ${to}: ${amountRaw} CSPR confirmed`);
