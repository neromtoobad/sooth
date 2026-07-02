// move spare native CSPR from agent keys to the deployer for contract installs
// (testnet faucet pays each account once; installs are gas-heavy, trades are not)
// usage: pnpm tsx scripts/consolidate.ts [amount_cspr_per_account]
import { readFileSync } from 'fs';
import { join } from 'path';
import { NativeTransferBuilder, PublicKey } from '../lib/sdk.ts';
import { CHAIN_NAME, EXPLORER, loadKey, rpc } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));
const AMOUNT_CSPR = Number(process.argv[2] ?? 700);
const MOTES = BigInt(AMOUNT_CSPR) * 1_000_000_000n;

const deployerPub = PublicKey.fromHex(accounts.deployer.publicKey);

for (const name of ['momo', 'meanie', 'vibes', 'resolver']) {
  const signer = loadKey(join(ROOT, 'keys', `${name}.pem`));
  const tx = new NativeTransferBuilder()
    .from(signer.publicKey)
    .target(deployerPub)
    .amount(MOTES.toString())
    .id(Date.now())
    .chainName(CHAIN_NAME)
    .payment(100_000_000) // native transfer cost
    .build();
  tx.sign(signer);
  const res = await rpc().putTransaction(tx);
  console.log(`${name} -> deployer ${AMOUNT_CSPR} CSPR: ${EXPLORER}/transaction/${(res.transactionHash.transactionV1 ?? res.transactionHash.deploy ?? res.transactionHash).toHex()}`);
  await rpc().waitForTransaction(tx, 120_000);
  console.log(`  confirmed`);
}
