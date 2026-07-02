// dump all effect keys of a transaction: pnpm tsx scripts/tx-effects.ts <txhash>
import { rpc } from '../lib/casper.ts';
const hash = process.argv[2];
const result = await rpc().getTransactionByTransactionHash(hash);
const effects = result.executionInfo?.executionResult?.effects ?? [];
for (const t of effects) console.log(String(t.key));
