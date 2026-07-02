// shared x402 config + server-side gate builder used by services/feed and services/oracle
// see NOTES_X402.md for the full wiring rationale
import { readFileSync } from 'fs';
import { join } from 'path';

export const NETWORK = 'casper:casper-test';

export interface X402Config {
  payTo: string; // 66-char account hash (00 + 64 hex) receiving payments
  assetPackageHash: string; // CEP-18 (Cep18X402/sUSD) contract package hash, 64 hex
  assetName: string; // EIP-712 domain name — must match token install args
  assetSymbol: string;
  assetDecimals: number;
  facilitatorUrl: string;
}

export function loadX402Config(): X402Config {
  const accounts = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'keys', 'accounts.json'), 'utf8'),
  );
  // deployer receives all x402 revenue
  const payTo = '00' + accounts.deployer.accountHash.replace('account-hash-', '');
  const assetPackageHash = requireEnv('SUSD_PACKAGE_HASH').replace(/^hash-/, '');
  return {
    payTo,
    assetPackageHash,
    assetName: process.env.SUSD_NAME ?? 'Sooth USD',
    assetSymbol: process.env.SUSD_SYMBOL ?? 'sUSD',
    assetDecimals: 9,
    facilitatorUrl: process.env.FACILITATOR_URL ?? 'http://localhost:4022',
  };
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name} — see .env.example`);
  return v;
}

/**
 * builds the x402 middleware pieces for an express app.
 * routes: { "GET /feed/btc": { price: "$0.0005", description: "..." } }
 */
export async function buildGate(
  routes: Record<string, { price: string; description: string }>,
) {
  const { paymentMiddleware, x402ResourceServer } = await import('@x402/express');
  const { ExactCasperScheme } = await import(
    '@make-software/casper-x402/exact/server'
  );
  const { HTTPFacilitatorClient } = await import('@x402/core/server');

  const cfg = loadX402Config();

  const scheme = new ExactCasperScheme()
    .registerAsset(NETWORK, cfg.assetPackageHash, cfg.assetDecimals)
    .registerMoneyParser(async () => ({
      asset: cfg.assetPackageHash,
      amount: '500000000', // 0.5 sUSD default, per-route price below overrides via money string
      extra: {
        name: cfg.assetName,
        symbol: cfg.assetSymbol,
        version: '1',
        decimals: String(cfg.assetDecimals),
      },
    }));

  const facilitator = new HTTPFacilitatorClient({ url: cfg.facilitatorUrl });
  const server = new x402ResourceServer(facilitator).register(NETWORK, scheme);

  const routeConfig: Parameters<typeof paymentMiddleware>[0] = {};
  for (const [route, { price, description }] of Object.entries(routes)) {
    routeConfig[route] = {
      accepts: [{ scheme: 'exact', price, network: NETWORK, payTo: cfg.payTo }],
      description,
      mimeType: 'application/json',
    };
  }

  return paymentMiddleware(routeConfig, server);
}
