// agent-side x402 client: wraps fetch so any agent auto-handles 402 → sign → retry.
// usage:
//   const fetchPaid = await payingFetch('keys/momo.pem');
//   const res = await fetchPaid('http://localhost:4021/feed/btc');
import { readFileSync } from 'fs';

export async function payingFetch(pemPath: string): Promise<typeof fetch> {
  const { x402Client, wrapFetchWithPayment } = await import('@x402/fetch');
  const { ExactCasperScheme } = await import(
    '@make-software/casper-x402/exact/client'
  );
  const { createClientCasperSigner } = await import(
    '@make-software/casper-x402'
  );
  const { KeyAlgorithm } = await import('./sdk.ts');

  const signer = await createClientCasperSigner(pemPath, KeyAlgorithm.ED25519);

  // accept the first payment option the server offers
  const selectFirst = ((_version: number, options: unknown[]) =>
    options[0]) as ConstructorParameters<typeof x402Client>[0];
  const client = new x402Client(selectFirst).register(
    'casper:*',
    new ExactCasperScheme(signer),
  );

  return wrapFetchWithPayment(fetch, client) as typeof fetch;
}

/** extract the on-chain settlement reference from a paid response, for logging */
export async function settlementRef(res: Response): Promise<string | null> {
  const header = res.headers.get('payment-response');
  if (!header) return null;
  try {
    const { decodePaymentResponseHeader } = await import('@x402/fetch');
    const decoded = decodePaymentResponseHeader(header) as unknown as Record<string, unknown>;
    return (decoded?.transaction ?? decoded?.txHash ?? JSON.stringify(decoded)) as string;
  } catch {
    return header;
  }
}

export function pemPathFor(agent: string): string {
  return new URL(`../keys/${agent}.pem`, import.meta.url).pathname;
}
