// generates the five sooth agent keypairs into keys/ as pem + accounts.json
// run: pnpm keygen  (idempotent — skips keys that already exist)
import { PrivateKey, KeyAlgorithm } from '../lib/sdk.ts';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const KEYS_DIR = join(import.meta.dirname, '..', 'keys');
const NAMES = ['deployer', 'momo', 'meanie', 'vibes', 'resolver', 'bull', 'bear', 'reserve1', 'reserve2', 'reserve3', 'reserve4', 'reserve5', 'reserve6', 'guest'] as const;

mkdirSync(KEYS_DIR, { recursive: true });

const accounts: Record<string, { publicKey: string; accountHash: string }> = {};

for (const name of NAMES) {
  const pemPath = join(KEYS_DIR, `${name}.pem`);
  let key: InstanceType<typeof PrivateKey>;
  if (existsSync(pemPath)) {
    key = PrivateKey.fromPem(readFileSync(pemPath, 'utf8'), KeyAlgorithm.ED25519);
    console.log(`${name}: exists, reusing`);
  } else {
    key = PrivateKey.generate(KeyAlgorithm.ED25519);
    writeFileSync(pemPath, key.toPem(), { mode: 0o600 });
    console.log(`${name}: generated`);
  }
  accounts[name] = {
    publicKey: key.publicKey.toHex(),
    accountHash: key.publicKey.accountHash().toPrefixedString(),
  };
}

writeFileSync(join(KEYS_DIR, 'accounts.json'), JSON.stringify(accounts, null, 2));

console.log('\npublic keys (faucet these at https://testnet.cspr.live/tools/faucet):\n');
for (const [name, a] of Object.entries(accounts)) {
  console.log(`  ${name.padEnd(9)} ${a.publicKey}`);
}
