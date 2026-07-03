#!/bin/bash
# deploys the flagship UNSIGNABLE market + seeds it + points LLM agents at it.
# run once the reserve keys are fauceted and consolidated to the deployer.
set -e
cd "$(dirname "$0")/.."
set -a; source .env; set +a

CLOSE=$(node -e "console.log(Date.parse('2026-09-01T00:00:00Z'))")
Q="Will an autonomous AI agent deploy a smart contract to Casper mainnet before 2026-09-01?"
CRITERIA="Resolve YES if, before the close date, there is credible public evidence that a contract was deployed to Casper mainnet by an AI agent acting autonomously (not a human clicking deploy). NO if no such evidence exists. The jury weighs public reports and reasoning; a near-miss (testnet only, or human-in-the-loop) is NO."

echo "creating flagship subjective market…"
pnpm tsx scripts/create-market.ts "$Q" "$CLOSE" subjective "$CRITERIA"

HASH=$(node -e "const d=require('./deployments.json'); console.log(d.markets[d.markets.length-1].hash)")
echo "seeding liquidity on $HASH…"
pnpm tsx scripts/seed-market.ts "$HASH" 60

echo "done. point LLM agents at it with MARKET_HASH=$HASH"
