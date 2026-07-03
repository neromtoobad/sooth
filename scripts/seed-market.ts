// approve + seed liquidity on a market: pnpm tsx scripts/seed-market.ts <hash> <susd>
import { join } from 'path';
import { SoothClient, toNano } from '../lib/sooth.ts';
import { EXPLORER } from '../lib/casper.ts';

const [hash, amount] = process.argv.slice(2);
const d = await SoothClient.connect(join(import.meta.dirname, '..', 'keys', 'deployer.pem'));
const a = await d.approve(hash, toNano(Number(amount) * 2));
console.log(`approve: ${EXPLORER}/transaction/${a}`);
const l = await d.addLiquidity(hash, toNano(Number(amount)));
console.log(`liquidity: ${EXPLORER}/transaction/${l}`);
