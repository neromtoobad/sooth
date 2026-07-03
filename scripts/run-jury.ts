// convene the LLM jury on any subjective claim — proves the resolution
// mechanism for unsignable truth without needing an on-chain market.
// usage: pnpm tsx scripts/run-jury.ts "<question>" ["<criteria>"] [marketHash]
import { adjudicate } from '../agents/src/jury.ts';
import { logActivity } from '../agents/src/base.ts';

const [question, criteria, marketHash] = process.argv.slice(2);
if (!question) {
  console.error('usage: run-jury.ts "<question>" ["<criteria>"] [marketHash]');
  process.exit(1);
}

const market = marketHash ?? 'demo-' + Date.now().toString(36);
const result = await adjudicate(market, question, criteria ?? '');

// emit the final ruling so the dashboard jury panel shows the outcome line
logActivity({
  agent: 'jury',
  action: result.decided ? 'ruled' : 'disputed',
  market,
  outcome: result.outcome,
  thesis: result.rationale,
});

console.log('\n── JURY RESULT ──────────────────────────────');
for (const v of result.verdicts) {
  console.log(`  ${v.juror.padEnd(18)} ${v.vote.toUpperCase().padEnd(11)} ${(v.confidence * 100).toFixed(0)}%  ${v.basis}`);
}
console.log('─────────────────────────────────────────────');
console.log(`  ${result.decided ? 'RULED' : 'DISPUTED'}: ${result.rationale}`);
