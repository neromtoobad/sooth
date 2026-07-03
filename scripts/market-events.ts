import { readMarketOnChain } from '../lib/market-reader.ts';
import { readFileSync } from 'fs';
import { join } from 'path';
const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));
const byHash = Object.fromEntries(Object.entries(accounts).map(([n, a]: [string, any]) => [a.accountHash.replace('account-hash-',''), n]));
// dump raw events
const { rpc } = await import('../lib/casper.ts');
const mod = await import('../lib/market-reader.ts');
const s = await mod.readMarketOnChain(process.argv[2] ?? '3359a9dcbb07a017aa1d75ebff9a61f182cf620cc476a3859c104f7e2572bed8');
console.log('state:', JSON.stringify({ ...s, yesPool: s.yesPool.toString(), noPool: s.noPool.toString() }));
