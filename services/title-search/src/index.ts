export * from "./rpc";
export * from "./direct";
export * from "./indexed";
export * from "./rate";
import { Rpc, validateName } from "./rpc";
import { direct } from "./direct";
import { indexed } from "./indexed";
import { rate } from "./rate";
import type { Report } from "@atto/shared";
const cache = new Map<string, { until: number; report: Report }>();
export async function titleSearch(input: string, options: { rpc?: Rpc; final?: boolean } = {}) {
  const name = validateName(input);
  const rpc = options.rpc ?? Rpc.fromEnv();
  const key = `${rpc.network}:${JSON.stringify(rpc.accounts)}:${name}`;
  const cached = cache.get(key);
  if (!options.final && cached && cached.until > Date.now()) return cached.report;
  const [d, i] = await Promise.all([direct(name, rpc), indexed(name, rpc)]);
  const report = rate(
    name,
    rpc.network,
    { ...d.sections, ...i.sections },
    [`${rpc.accounts.rpc} (finalized RPC; individual reads may span blocks)`, ...i.sources],
    i.nfts,
    options.final,
  );
  if (!options.final) {
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 60_000, report });
  }
  return report;
}
