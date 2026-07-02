// consumer — simulates an external protocol's risk agent consuming the sooth
// oracle: pays x402, reads the market-priced probability, applies a decision
// rule. this is the oracle-as-a-service proof.
import { payingFetch, pemPathFor, settlementRef } from '@sooth/lib/x402-client.ts';
import { logActivity } from './base.ts';

const ORACLE_URL = process.env.ORACLE_URL ?? 'http://localhost:4023/oracle';
const MARKET_HASH = process.env.MARKET_HASH ?? '';
const INTERVAL_MS = Number(process.env.CONSUMER_INTERVAL_MS ?? 120_000);
const HEDGE_THRESHOLD = 0.7;

async function main() {
  if (!MARKET_HASH) throw new Error('MARKET_HASH env required');
  const fetchPaid = await payingFetch(pemPathFor('vibes')); // reuses vibes key for demo

  logActivity({ agent: 'consumer', action: 'start', market: MARKET_HASH });

  for (;;) {
    try {
      const res = await fetchPaid(`${ORACLE_URL}/${MARKET_HASH}`);
      if (!res.ok) throw new Error(`oracle ${res.status}`);
      const data = (await res.json()) as { p_yes: number; question: string };
      const paymentRef = await settlementRef(res);

      const hedge = data.p_yes > HEDGE_THRESHOLD;
      logActivity({
        agent: 'consumer',
        action: 'oracle_read',
        p_yes: data.p_yes,
        decision: hedge ? 'hedge ON' : 'hedge OFF',
        rule: `p_yes > ${HEDGE_THRESHOLD} -> hedge`,
        x402_payment: paymentRef,
      });
    } catch (e) {
      logActivity({ agent: 'consumer', action: 'error', error: String(e) });
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();
