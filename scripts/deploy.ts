// phase 2.1 — deploy sooth to casper testnet.
// order: sUSD (the prebuilt odra Cep18X402 wasm, doubling as x402 payment token)
//        → BinaryMarketFactory (odra codegen factory) → MarketFactory (registry).
// every hash lands in deployments.json. run: pnpm tsx scripts/deploy.ts
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Args, CLValue } from '../lib/sdk.ts';
import { installWasm, loadKey, namedKeyPackageHash, EXPLORER } from '../lib/casper.ts';

const ROOT = join(import.meta.dirname, '..');
const DEPLOYMENTS = join(ROOT, 'deployments.json');
const WASM_DIR = join(ROOT, 'contracts', 'wasm');
const X402_TOKEN_WASM = join(ROOT, '..', 'casper-x402', 'infra', 'local', 'deployer', 'Cep18X402.wasm');

const INITIAL_SUPPLY = '1000000000000000'; // 1,000,000 sUSD at 9 decimals

function odraCfg(keyName: string) {
  return {
    odra_cfg_is_upgradable: CLValue.newCLValueBool(true),
    odra_cfg_is_upgrade: CLValue.newCLValueBool(false),
    odra_cfg_allow_key_override: CLValue.newCLValueBool(true),
    odra_cfg_package_hash_key_name: CLValue.newCLString(keyName),
  };
}

function saveDeployments(d: Record<string, unknown>) {
  writeFileSync(DEPLOYMENTS, JSON.stringify(d, null, 2) + '\n');
}

async function main() {
  const deployer = loadKey(join(ROOT, 'keys', 'deployer.pem'));
  const state: Record<string, unknown> = existsSync(DEPLOYMENTS)
    ? JSON.parse(readFileSync(DEPLOYMENTS, 'utf8'))
    : { network: 'casper-test', markets: [] };
  const txs: Record<string, string> = (state.txs as Record<string, string>) ?? {};
  state.txs = txs;

  // 1. sUSD — the x402-capable CEP-18 deployed under sooth branding
  if (!state.susdPackageHash) {
    console.log('installing sUSD (Cep18X402.wasm)…');
    const out = await installWasm({
      signer: deployer,
      wasmPath: X402_TOKEN_WASM,
      args: Args.fromMap({
        name: CLValue.newCLString('Sooth USD'),
        symbol: CLValue.newCLString('sUSD'),
        decimals: CLValue.newCLUint8(9),
        initial_supply: CLValue.newCLUInt256(INITIAL_SUPPLY),
        chain_id: CLValue.newCLString('casper:casper-test'), // EIP-712 domain for x402
        ...odraCfg('susd_package_hash'),
      }),
      paymentMotes: 800_000_000_000,
    });
    txs.susd_install = out.explorerLink;
    state.susdPackageHash = await namedKeyPackageHash(deployer, 'susd_package_hash');
    saveDeployments(state);
    console.log(`  sUSD package: ${state.susdPackageHash}\n  ${out.explorerLink}`);
  }

  // 2. BinaryMarketFactory — odra codegen deployer for market instances
  if (!state.binaryMarketFactoryHash) {
    console.log('installing BinaryMarketFactory…');
    const out = await installWasm({
      signer: deployer,
      wasmPath: join(WASM_DIR, 'BinaryMarketFactory.wasm'),
      args: Args.fromMap({ ...odraCfg('bm_factory_package_hash') }),
      paymentMotes: 500_000_000_000,
    });
    txs.bm_factory_install = out.explorerLink;
    state.binaryMarketFactoryHash = await namedKeyPackageHash(deployer, 'bm_factory_package_hash');
    saveDeployments(state);
    console.log(`  BinaryMarketFactory package: ${state.binaryMarketFactoryHash}\n  ${out.explorerLink}`);
  }

  // 3. MarketFactory — registry + create_market entry point
  if (!state.factoryPackageHash) {
    console.log('installing MarketFactory…');
    const { Key } = await import('../lib/sdk.ts');
    const out = await installWasm({
      signer: deployer,
      wasmPath: join(WASM_DIR, 'MarketFactory.wasm'),
      args: Args.fromMap({
        deployer_contract: CLValue.newCLKey(Key.newKey(`hash-${state.binaryMarketFactoryHash}`)),
        token: CLValue.newCLKey(Key.newKey(`hash-${state.susdPackageHash}`)),
        ...odraCfg('market_factory_package_hash'),
      }),
      paymentMotes: 400_000_000_000,
    });
    txs.market_factory_install = out.explorerLink;
    state.factoryPackageHash = await namedKeyPackageHash(deployer, 'market_factory_package_hash');
    saveDeployments(state);
    console.log(`  MarketFactory package: ${state.factoryPackageHash}\n  ${out.explorerLink}`);
  }

  state.deployedAt = new Date().toISOString();
  saveDeployments(state);
  console.log(`\ndone. verify at ${EXPLORER} — hashes in deployments.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
