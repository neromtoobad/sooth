// print native CSPR balances for all five sooth keys
import { readFileSync } from 'fs';
import { join } from 'path';
import { PublicKey, PurseIdentifier } from '../lib/sdk.ts';
import { rpc } from '../lib/casper.ts';

const accounts = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'keys', 'accounts.json'), 'utf8'),
) as Record<string, { publicKey: string }>;

for (const [name, { publicKey }] of Object.entries(accounts)) {
  try {
    const res = await rpc().queryLatestBalance(
      PurseIdentifier.fromPublicKey(PublicKey.fromHex(publicKey)),
    );
    const cspr = Number(BigInt(res.balance.toString()) / 1_000_000n) / 1000;
    console.log(`${name.padEnd(9)} ${cspr} CSPR`);
  } catch (e) {
    console.log(`${name.padEnd(9)} NO ACCOUNT ON CHAIN (${String(e).slice(0, 60)})`);
  }
}
