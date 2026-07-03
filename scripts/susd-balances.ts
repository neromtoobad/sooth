import { readFileSync } from 'fs';
import { join } from 'path';
import { SoothClient } from '../lib/sooth.ts';
const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));
const c = await SoothClient.connect(join(ROOT, 'keys', 'deployer.pem'));
for (const n of ['deployer', 'momo', 'meanie', 'vibes']) {
  const b = await c.susdBalance(accounts[n].accountHash);
  console.log(`${n.padEnd(9)} ${(Number(b) / 1e9).toFixed(2)} sUSD`);
}
