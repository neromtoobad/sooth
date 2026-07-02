// dump a contract's named keys: pnpm tsx scripts/inspect-contract.ts <entity-contract-hash>
import { rpc } from '../lib/casper.ts';
const hash = process.argv[2];
for (const form of [`entity-contract-${hash}`, `hash-${hash}`]) {
  try {
    const r = await rpc().queryLatestGlobalState(form, []);
    const sv = r.storedValue as Record<string, unknown>;
    console.log(`== ${form}: stored value fields:`, Object.keys(sv).filter(k => (sv as any)[k] != null));
    const entity = (sv as any).addressableEntity ?? (sv as any).contract;
    if (entity?.namedKeys) {
      for (const nk of entity.namedKeys) console.log('  namedKey:', nk.name, '->', String(nk.key));
    }
    if ((sv as any).namedKeys) {
      for (const nk of (sv as any).namedKeys) console.log('  namedKey:', nk.name, '->', String(nk.key));
    }
  } catch (e) {
    console.log(`== ${form}: ${String(e).slice(0, 100)}`);
  }
}
