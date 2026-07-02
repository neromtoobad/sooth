// phase 2.2 — create the demo markets, fund the agents, seed liquidity.
// usage: pnpm tsx scripts/create-markets.ts
//   env: STRIKE_MAIN (main market strike $), LIQUIDITY_SUSD (seed per market, default 100)
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SoothClient, loadDeployments, toNano } from '../lib/sooth.ts';
import { EXPLORER } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'keys', 'accounts.json'), 'utf8'));
const DEPLOYMENTS = join(ROOT, 'deployments.json');

const LIQUIDITY = toNano(Number(process.env.LIQUIDITY_SUSD ?? 100));
const AGENT_FUNDING = toNano(200); // sUSD per trader

async function currentBtc(): Promise<number> {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  return ((await r.json()) as { bitcoin: { usd: number } }).bitcoin.usd;
}

async function main() {
  const deployer = await SoothClient.connect(join(ROOT, 'keys', 'deployer.pem'));
  const state = loadDeployments() as ReturnType<typeof loadDeployments> & Record<string, unknown>;
  const spot = await currentBtc();

  // market 1: main demo market closing july 6 00:00 UTC, strike = spot +1%
  const strikeMain = Number(process.env.STRIKE_MAIN ?? Math.round(spot * 1.01));
  const closeMain = Date.parse('2026-07-06T00:00:00Z');
  // market 2: 2h lifecycle-test market, strike = current spot
  const strikeShort = Math.round(spot);
  const closeShort = Date.now() + 2 * 3600_000;

  const wanted = [
    { question: `BTC/USD closes above $${strikeMain} at 2026-07-06 00:00 UTC`, closeTs: closeMain, strike: strikeMain },
    { question: `BTC/USD above $${strikeShort} in 2 hours`, closeTs: closeShort, strike: strikeShort },
  ];

  for (const m of wanted) {
    if (state.markets.some((x) => x.question === m.question)) continue;
    console.log(`creating market: ${m.question}`);
    const tx = await deployer.createMarket(m.question, m.closeTs, accounts.resolver.accountHash);
    console.log(`  tx: ${EXPLORER}/transaction/${tx}`);
    // the MarketCreated event carries the child address; grab it from the factory registry
    // (postprocessing step — fill markets[].hash from the factory's markets() view or explorer)
    state.markets.push({ ...m, hash: 'FILL_FROM_EVENT_' + tx });
  }

  // fund traders with sUSD
  for (const name of ['momo', 'meanie', 'vibes']) {
    console.log(`funding ${name} with 200 sUSD…`);
    const tx = await deployer.transferSusd(accounts[name].accountHash, AGENT_FUNDING);
    console.log(`  tx: ${EXPLORER}/transaction/${tx}`);
  }

  // approvals + liquidity per market (deployer)
  for (const m of state.markets) {
    if (m.hash.startsWith('FILL_FROM_EVENT_')) {
      console.log(`!! market "${m.question}" needs its hash filled in deployments.json before liquidity can be added`);
      continue;
    }
    console.log(`approving + seeding ${m.question}…`);
    await deployer.approve(m.hash, LIQUIDITY * 2n);
    const tx = await deployer.addLiquidity(m.hash, LIQUIDITY);
    console.log(`  liquidity tx: ${EXPLORER}/transaction/${tx}`);
  }

  writeFileSync(DEPLOYMENTS, JSON.stringify(state, null, 2) + '\n');
  console.log('\ndeployments.json updated');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
