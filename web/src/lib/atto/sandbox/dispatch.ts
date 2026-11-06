import { z } from "zod";
import { Refusal } from "../mock/world";
import { sandbox } from "./backend";

const yocto = z.string().regex(/^\d+$/);
const token = z.string().min(1).max(128);
const id = z.string().min(1).max(32);
const byName = z.object({ name: token });
const byId = z.object({ id });

type Handler = (caller: string, args: unknown) => unknown;

function method<S extends z.ZodType>(schema: S, run: (caller: string, args: z.infer<S>) => unknown): Handler {
  return (caller, args) => run(caller, schema.parse(args));
}

const keeperLater = method(z.unknown(), () => {
  throw new Refusal("Keeper controls run on the mock data in this build. The sandbox covers the Clean Sale.");
});

/** The same methods as the mock, served by the escrow on the local sandbox. */
export const SANDBOX_METHODS: Record<string, Handler> = {
  getReport: method(byName, (_, a) => sandbox.getReport(a.name)),
  getHistory: method(byName, (_, a) => sandbox.getHistory(a.name)),
  changedOwner: method(z.object({ name: token, days: z.number().int().min(1).max(3650) }), (_, a) =>
    sandbox.changedOwner(a.name, a.days),
  ),
  sampleNames: method(z.object({}), () => sandbox.sampleNames()),
  ownedBy: method(z.object({}), (c) => sandbox.ownedBy(c)),
  openSales: method(z.object({}), () => sandbox.openSales()),
  mySales: method(z.object({}), (c) => sandbox.mySales(c)),
  getSale: method(byId, (c, a) => sandbox.getSale(c, a.id)),
  list: method(z.object({ token_id: token, price: yocto }), (c, a) => sandbox.list(c, a.token_id, a.price)),
  delist: method(byId, (c, a) => sandbox.delist(c, a.id)),
  pay: method(z.object({ id, fingerprint: z.string() }), (c, a) => sandbox.pay(c, a.id, a.fingerprint)),
  cancel: method(byId, (c, a) => sandbox.cancel(c, a.id)),
  reclaimPayment: method(byId, (_, a) => sandbox.reclaimPayment(a.id)),
  handOver: method(byId, (c, a) => sandbox.handOver(c, a.id)),
  acceptChangedReport: method(byId, (c, a) => sandbox.acceptChangedReport(c, a.id)),
  reverse: method(byId, (_, a) => sandbox.reverse(a.id)),
  getOwnerView: keeperLater,
  configureKeeper: keeperLater,
  topUp: keeperLater,
  withdraw: keeperLater,
  renew: keeperLater,
};
