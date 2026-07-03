// one-shot: claim winnings on a resolved market for each agent, with retries
import { join } from 'path';
import { SoothClient } from '../lib/sooth.ts';
import { EXPLORER } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const market = process.argv[2] ?? '3359a9dcbb07a017aa1d75ebff9a61f182cf620cc476a3859c104f7e2572bed8';

for (const name of ['momo', 'meanie', 'vibes']) {
  const client = await SoothClient.connect(join(ROOT, 'keys', `${name}.pem`));
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tx = await client.claim(market);
      console.log(`${name}: CLAIMED ${EXPLORER}/transaction/${tx}`);
      break;
    } catch (e) {
      const msg = String(e);
      if (msg.includes('User error: 8')) {
        console.log(`${name}: nothing to claim (held no winning shares)`);
        break;
      }
      console.log(`${name}: attempt ${attempt} failed: ${msg.slice(0, 90)}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 15_000));
    }
  }
}
