// phase 2.3 — end-to-end smoke: momo buys YES, price must move. prints receipts.
// usage: MARKET_HASH=<hash> pnpm tsx scripts/smoke.ts
import { join } from 'path';
import { SoothClient, loadDeployments, toNano } from '../lib/sooth.ts';
import { EXPLORER } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');

async function main() {
  const marketHash = process.env.MARKET_HASH ?? loadDeployments().markets.at(-1)?.hash;
  if (!marketHash || marketHash.startsWith('FILL_')) throw new Error('no usable MARKET_HASH');

  const momo = await SoothClient.connect(join(ROOT, 'keys', 'momo.pem'));

  const before = await momo.priceYes(marketHash);
  console.log(`p_yes before: ${(before * 100).toFixed(1)}%`);

  console.log('approving 10 sUSD…');
  await momo.approve(marketHash, toNano(10));

  console.log('momo buys 10 sUSD of YES…');
  const tx = await momo.buyYes(marketHash, toNano(10));
  console.log(`trade tx: ${EXPLORER}/transaction/${tx}`);

  const after = await momo.priceYes(marketHash);
  console.log(`p_yes after: ${(after * 100).toFixed(1)}%`);

  if (after <= before) throw new Error('price did not move up after YES buy');
  console.log('\nsmoke test PASSED — price moved on-chain');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
