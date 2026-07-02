# NOTES_X402.md — how sooth wires x402

> distilled from make-software/casper-x402 (cloned at ../casper-x402). written phase 0, consumed by services/feed (P3.1) and services/oracle (P4.1).

## packages we import

| package | role |
|---|---|
| `@make-software/casper-x402` | casper payment scheme — `./exact/server`, `./exact/client`, `createClientCasperSigner` |
| `@x402/express` | `paymentMiddleware`, `x402ResourceServer` — gates express routes |
| `@x402/fetch` | `x402Client`, `wrapFetchWithPayment` — agent-side auto 402→pay→retry |
| `@x402/core` | `HTTPFacilitatorClient` (server), shared types |
| `casper-js-sdk` v5 | already in workspace |
| `@casper-ecosystem/casper-eip-712` | pulled in transitively for typed-data signing |

node 20+, pnpm 10+ — we have both.

## the flow

1. agent GETs `/feed/btc` → server replies **402** with base64 `PAYMENT-REQUIRED` header (price, network, payTo, asset)
2. `wrapFetchWithPayment` decodes, signs an EIP-712 `transfer_with_authorization` for the CEP-18 asset, retries with `PAYMENT-SIGNATURE` header
3. server hands signature to the **facilitator**, which submits the settlement tx on-chain and pays gas
4. server returns **200** + `PAYMENT-RESPONSE` header containing the settlement reference (tx hash → explorer link for the demo)

payer never spends gas; the facilitator key does. payee (`payTo`) is just an account hash receiving tokens.

## wiring plan for services/feed and services/oracle

- both services share one module `lib/x402.ts` exporting `gate(routes)` built on `paymentMiddleware` + `ExactCasperScheme` (server flavor)
- agents share `lib/x402-client.ts`: `payingFetch(pemPath)` → `wrapFetchWithPayment` with `ExactCasperScheme(createClientCasperSigner(pem, ED25519))` registered for `casper:*`
- network id is CAIP-2: **`casper:casper-test`** (not "casper-testnet")
- `payTo` = deployer **account hash** (66 chars, `00` + 64 hex — accounts.json has it)
- prices: feed `$0.001`-style money strings or motes; we configure ~0.5 CSPR feed / 1 CSPR oracle equivalent

## payment asset — DECISION: one token for everything

x402 settles in a **CEP-18 token that implements `transfer_with_authorization`**. plain CEP-18 (incl. odra's stock module) does NOT have that entry point. the repo ships a prebuilt, odra-built token that does: `infra/local/deployer/Cep18X402.wasm` (install args: name, symbol, decimals, initial_supply, chain_id + odra_cfg_* — see infra/local/deployer/deployer.cs; initial supply mints to installer).

**decision: deploy Cep18X402.wasm AS sUSD** — name "Sooth USD", symbol sUSD, decimals 9, `chain_id=casper:casper-test`, big initial_supply to deployer. agents trade markets AND pay x402 fees in the same token. kills step 1.1 (no custom token contract), and "one token powers the whole economy" is a better story. deployer transfers = the faucet; BinaryMarket only needs standard approve/transfer_from which the CEP-18 base provides.

fallback if the prebuilt wasm misbehaves on testnet: odra stock CEP-18 as sUSD for trading + separately deploy Cep18X402 with default branding purely as the x402 payment token.

## facilitator

- primary: CSPR.cloud hosted facilitator (https://docs.cspr.cloud/x402-facilitator-api/reference) — needs CSPR_CLOUD_API_KEY; buildathon teams get sponsored usage (ask in discord)
- fallback (proven, local): run the reference facilitator from the examples ourselves —
  `CASPER_NETWORKS=casper:casper-test`, `SECRET_KEY_PEM_CASPER_CASPER_TEST` (a funded key, use deployer), `RPCURL_CASPER_CASPER_TEST=https://node.testnet.casper.network/rpc`, `TRANSACTION_PAYMENT_MOTES≈7000000000`. settlements are still real on-chain txs, so demo receipts are unaffected. this beats the "self-verified transfer" fallback in BUILD_GUIDE — protocol-faithful with zero shortcuts.

## dry-run commands (P0.3, after keys are funded)

```bash
cd ../casper-x402 && pnpm install && pnpm build
pnpx tsx js/examples/facilitator/index.ts   # :4022
pnpx tsx js/examples/server/index.ts        # :4021
pnpx tsx js/examples/client/index.ts        # 402 → pay → 200
```

env per js/examples/*/README.md + /.env.template (WCSPR package hash lives there).

## gotchas

- pnpm only (workspace: deps), node 20+
- payTo/account-hash format ≠ public key — use accounts.json accountHash minus the `account-hash-` prefix, `00`-prefixed per examples
- client + server must agree on the asset's EIP-712 domain fields (name/version/decimals)
- facilitator key must be funded and distinct from payTo
