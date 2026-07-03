// create one market via the on-chain factory and record it in deployments.json.
// deterministic: pnpm tsx scripts/create-market.ts "<question with $STRIKE>" <closeTs-ms> <strike>
// subjective:    pnpm tsx scripts/create-market.ts "<question>" <closeTs-ms> subjective "<resolution criteria>"
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SoothClient } from '../lib/sooth.ts';
import { rpc, EXPLORER } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const DEPLOYMENTS = join(ROOT, 'deployments.json');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));

const [question, closeTsRaw, arg3, arg4] = process.argv.slice(2);
if (!question || !closeTsRaw || !arg3) {
  console.error(
    'usage: create-market.ts "<question>" <closeTs-ms> <strike | "subjective"> [criteria]',
  );
  process.exit(1);
}
const closeTs = Number(closeTsRaw);
const subjective = arg3 === 'subjective';
const strike = subjective ? undefined : Number(arg3);
const criteria = subjective ? (arg4 ?? '') : undefined;

const deployer = await SoothClient.connect(join(ROOT, 'keys', 'deployer.pem'));
console.log(
  `creating ${subjective ? 'SUBJECTIVE' : 'deterministic'} market: ${question} (close ${new Date(
    closeTs,
  ).toISOString()})`,
);
const tx = await deployer.createMarket(question, closeTs, accounts.resolver.accountHash);
console.log(`tx: ${EXPLORER}/transaction/${tx}`);

// find the new market's package hash: a package whose (sole) contract was
// created by this very transaction
const result = await rpc().getTransactionByTransactionHash(tx);
const effects = result.executionInfo?.executionResult?.effects ?? [];
const candidates = [
  ...new Set(
    effects
      .map((t) => String(t.key))
      .filter((k) => k.startsWith('hash-'))
      .map((k) => k.slice(5)),
  ),
];

const apiKey = process.env.CSPR_CLOUD_API_KEY!;
let marketHash: string | null = null;
for (const h of candidates) {
  const res = await fetch(`https://api.testnet.cspr.cloud/contract-packages/${h}/contracts`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) continue;
  const body = (await res.json()) as { data?: { deploy_hash: string }[] };
  if (body.data?.some((c) => c.deploy_hash === tx)) {
    marketHash = h;
    break;
  }
}
if (!marketHash) throw new Error('could not locate new market package hash in effects');

const state = JSON.parse(readFileSync(DEPLOYMENTS, 'utf8'));
state.markets = state.markets ?? [];
state.markets.push({
  hash: marketHash,
  question,
  closeTs,
  ...(subjective ? { kind: 'subjective', criteria } : { kind: 'deterministic', strike }),
  createTx: tx,
});
writeFileSync(DEPLOYMENTS, JSON.stringify(state, null, 2) + '\n');

console.log(`market package: ${marketHash}`);
console.log(`explorer: ${EXPLORER}/contract-package/${marketHash}`);
console.log('recorded in deployments.json');
