// prove the x402 loop: 402 → sign payment → retry → 200 + on-chain settlement
import { payingFetch, pemPathFor, settlementRef } from '../lib/x402-client.ts';

const url = process.env.FEED_URL ?? 'http://localhost:4021/feed/btc';

const unpaid = await fetch(url);
console.log('unpaid request:', unpaid.status);

const fetchPaid = await payingFetch(pemPathFor('momo'));
const res = await fetchPaid(url);
console.log('paid request:', res.status);
if (res.ok) {
  const data = (await res.json()) as { spot: number };
  console.log('BTC spot from paid feed:', data.spot);
  console.log('settlement:', await settlementRef(res));
}
