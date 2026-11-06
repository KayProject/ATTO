export interface KeeperDriver {
  enabledNames(): Promise<string[]>;
  pullPlan(name: string): Promise<{ amount: bigint; remainingCap: bigint; enabled: boolean }>;
  pull(name: string, amount: string): Promise<void>;
  dueSoon(): Promise<string[]>;
  renew(name: string): Promise<void>;
  collectRefunds(): Promise<void>;
}
export async function keeperTick(
  driver: KeeperDriver,
  now: number,
  last: { pull: number; renew: number; refund: number },
) {
  const errors: { name: string; error: string }[] = [];
  async function run(name: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      errors.push({ name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  if (now - last.pull >= 3600000) {
    for (const name of await driver.enabledNames())
      await run(name, async () => {
        const p = await driver.pullPlan(name);
        if (p.enabled && p.amount > 0n && p.remainingCap > 0n)
          await driver.pull(name, (p.amount < p.remainingCap ? p.amount : p.remainingCap).toString());
      });
    last.pull = now;
  }
  if (now - last.renew >= 86400000) {
    for (const name of await driver.dueSoon()) await run(name, () => driver.renew(name));
    last.renew = now;
  }
  if (now - last.refund >= 7 * 86400000) {
    await run("refunds", () => driver.collectRefunds());
    last.refund = now;
  }
  return { last, errors };
}
