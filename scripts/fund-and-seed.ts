// fund trader accounts with sUSD + approve and seed liquidity on all markets
// usage: pnpm tsx scripts/fund-and-seed.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { SoothClient, loadDeployments, toNano } from '../lib/sooth.ts';
import { EXPLORER } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));

const TRADER_SUSD = toNano(200);
const LIQUIDITY = toNano(Number(process.env.LIQUIDITY_SUSD ?? 100));

const deployer = await SoothClient.connect(join(ROOT, 'keys', 'deployer.pem'));

for (const name of ['momo', 'meanie', 'vibes']) {
  const bal = await deployer.susdBalance(accounts[name].accountHash).catch(() => 0n);
  if (bal >= TRADER_SUSD) {
    console.log(`${name}: already has sUSD, skipping`);
    continue;
  }
  console.log(`funding ${name} with 200 sUSD…`);
  const tx = await deployer.transferSusd(accounts[name].accountHash, TRADER_SUSD);
  console.log(`  ${EXPLORER}/transaction/${tx}`);
}

for (const m of loadDeployments().markets) {
  console.log(`seeding "${m.question}"…`);
  const approveTx = await deployer.approve(m.hash, LIQUIDITY * 2n);
  console.log(`  approve: ${EXPLORER}/transaction/${approveTx}`);
  const liqTx = await deployer.addLiquidity(m.hash, LIQUIDITY);
  console.log(`  liquidity: ${EXPLORER}/transaction/${liqTx}`);
}

console.log('\ndone — markets are tradeable');
