import { z } from "zod";
import { getWorld, resetWorld, runBot } from "./singleton";

const yocto = z.string().regex(/^\d+$/);
const token = z.string().min(1).max(128);
const id = z.string().min(1).max(32);

type Handler = (caller: string, args: unknown) => unknown;

function method<S extends z.ZodType>(schema: S, run: (caller: string, args: z.infer<S>) => unknown): Handler {
  return (caller, args) => run(caller, schema.parse(args));
}

const byName = z.object({ name: token });
const byId = z.object({ id });

/** Everything the browser may ask the mock to do, with its arguments checked. */
export const METHODS: Record<string, Handler> = {
  getReport: method(byName, (_, a) => getWorld().getReport(a.name)),
  getHistory: method(byName, (_, a) => getWorld().getHistory(a.name)),
  changedOwner: method(z.object({ name: token, days: z.number().int().min(1).max(3650) }), (_, a) =>
    getWorld().changedOwner(a.name, a.days),
  ),
  sampleNames: method(z.object({}), () => getWorld().sampleNames()),
  ownedBy: method(z.object({}), (c) => getWorld().ownedBy(c)),
  openSales: method(z.object({}), () => getWorld().openSales()),
  mySales: method(z.object({}), (c) => getWorld().mySales(c)),
  getSale: method(byId, (c, a) => getWorld().getSale(c, a.id)),
  list: method(z.object({ token_id: token, price: yocto }), (c, a) => getWorld().list(c, a.token_id, a.price)),
  delist: method(byId, (c, a) => getWorld().delist(c, a.id)),
  pay: method(z.object({ id, fingerprint: z.string() }), (c, a) => getWorld().pay(c, a.id, a.fingerprint)),
  cancel: method(byId, (c, a) => getWorld().cancel(c, a.id)),
  reclaimPayment: method(byId, (_, a) => getWorld().reclaimPayment(a.id)),
  handOver: method(byId, (c, a) => {
    const result = getWorld().handOver(c, a.id);
    if (result.accepted) runBot(a.id);
    return result;
  }),
  acceptChangedReport: method(byId, (c, a) => {
    getWorld().acceptChangedReport(c, a.id);
    runBot(a.id);
  }),
  reverse: method(byId, (_, a) => getWorld().reverse(a.id)),
  getOwnerView: method(byName, (c, a) => getWorld().getOwnerView(c, a.name)),
  configureKeeper: method(z.object({ name: token, enabled: z.boolean(), share_bps: z.number().int() }), (c, a) =>
    getWorld().configureKeeper(c, a.name, a.enabled, a.share_bps),
  ),
  topUp: method(z.object({ name: token, amount: yocto }), (_, a) => getWorld().topUp(a.name, a.amount)),
  withdraw: method(z.object({ name: token, amount: yocto }), (c, a) => getWorld().withdraw(c, a.name, a.amount)),
  renew: method(byName, (_, a) => getWorld().renew(a.name)),
  // Mock tools, not part of the real product.
  advanceClock: method(z.object({ hours: z.number().positive().max(24 * 400) }), (_, a) => {
    getWorld().advanceClock(a.hours);
    return getWorld().nowIso();
  }),
  resetWorld: method(z.object({}), () => resetWorld()),
};
