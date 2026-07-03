// transfer sUSD from deployer to an agent: pnpm tsx scripts/fund-susd.ts <agent> <susd>
import { readFileSync } from 'fs';
import { join } from 'path';
import { SoothClient, toNano } from '../lib/sooth.ts';
import { EXPLORER } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));
const [agent, amount] = process.argv.slice(2);
const deployer = await SoothClient.connect(join(ROOT, 'keys', 'deployer.pem'));
const tx = await deployer.transferSusd(accounts[agent].accountHash, toNano(Number(amount ?? 150)));
console.log(`deployer -> ${agent} ${amount} sUSD: ${EXPLORER}/transaction/${tx}`);
