// Reads served from the deployed escrow and the registry on the wallet network. Server only.
// Nothing here signs: every transaction is approved in the visitor's wallet.
import { z } from "zod";
import {
  CLEARING_TIMEOUT_NS,
  RECLAIM_AFTER_NS,
  accountsFromEnv,
  type Listing,
  type Report,
} from "@atto/shared";
import { Rpc, titleSearch } from "@atto/title-search";
import { liveReport } from "../live";
import { NETWORK } from "../backend";
import { Refusal } from "../mock/world";
import type { ChangedAnswer, HistoryEvent, OwnedName, SaleView } from "../types";

const MAX_LISTINGS = 200;
const MAX_OWNED = 20;
const BATCH = 4;

function context() {
  if (!NETWORK) throw new Refusal("No NEAR network is configured for wallet mode.");
  const { accounts } = accountsFromEnv({ ...process.env, ATTO_NETWORK: NETWORK });
  if (!accounts.escrow) throw new Refusal(`The escrow isn't deployed on ${NETWORK}.`);
  return { rpc: new Rpc(accounts, NETWORK), escrow: accounts.escrow, registry: accounts.registry };
}
type Ctx = ReturnType<typeof context>;

const listing = (ctx: Ctx, id: string) => ctx.rpc.view<Listing | null>(ctx.escrow, "get_listing", { listing_id: id });

async function chainNow(ctx: Ctx) {
  const block = await ctx.rpc.call<{ header: { timestamp_nanosec: string } }>("block", { finality: "final" });
  return block.header.timestamp_nanosec;
}

/** Every listing the escrow holds. Ids count up from 1, so this reads until the first gap. */
async function allListings(ctx: Ctx) {
  const found: Listing[] = [];
  for (let from = 1; from <= MAX_LISTINGS; from += BATCH) {
    const batch = await Promise.all(Array.from({ length: BATCH }, (_, i) => listing(ctx, String(from + i))));
    const present = batch.filter((l): l is Listing => l !== null);
    found.push(...present);
    if (present.length < batch.length) break;
  }
  return found;
}

async function finalReport(ctx: Ctx, name: string): Promise<Report> {
  return titleSearch(name, { rpc: ctx.rpc, final: true });
}

const noHistory: (name: string) => Promise<HistoryEvent[]> = async () => [];
const noChange: (name: string, days: number) => Promise<ChangedAnswer | null> = async () => null;

export const mainnet = {
  getReport: (name: string) => liveReport(name),
  // History needs the follower's database, which this deployment doesn't have.
  getHistory: noHistory,
  changedOwner: noChange,
  sampleNames: async () => [],

  async config() {
    const ctx = context();
    return { escrow: ctx.escrow, registry: ctx.registry };
  },

  async ownedBy(caller: string): Promise<OwnedName[]> {
    if (!caller) return [];
    const ctx = context();
    const tokens = await ctx.rpc.view<{ token_id: string; metadata?: { extra?: string } }[]>(
      ctx.registry,
      "nft_tokens_for_owner",
      { account_id: caller, limit: MAX_OWNED },
    );
    return Promise.all(
      tokens.map(async (token) => {
        const expires = JSON.parse(token.metadata?.extra ?? "{}").expires_at as string | undefined;
        const [open, report] = await Promise.all([
          ctx.rpc.view<Listing | null>(ctx.escrow, "listing_for_token", { token_id: token.token_id }),
          titleSearch(token.token_id, { rpc: ctx.rpc }),
        ]);
        return {
          name: token.token_id,
          lease_end: expires ? new Date(Number(BigInt(expires) / 1_000_000n)).toISOString() : "",
          listing_id: open && open.state === "Listed" ? open.id : null,
          clean_sale: report.clean_sale,
        };
      }),
    );
  },

  async openSales() {
    return (await allListings(context())).filter((l) => l.state === "Listed");
  },

  async mySales(caller: string) {
    if (!caller) return [];
    const ctx = context();
    return (await ctx.rpc.view<Listing[]>(ctx.escrow, "listings_for", { account_id: caller })).reverse();
  },

  async listingFor(token_id: string) {
    const ctx = context();
    return ctx.rpc.view<Listing | null>(ctx.escrow, "listing_for_token", { token_id });
  },

  finalReport: (name: string) => finalReport(context(), name),

  async getSale(caller: string, id: string): Promise<SaleView | null> {
    const ctx = context();
    const l = await listing(ctx, id);
    if (!l) return null;
    const held = l.state === "NameHeld" || l.state === "Clearing" || l.state === "Verified";
    const [report, final, now] = await Promise.all([
      titleSearch(l.token_id, { rpc: ctx.rpc }),
      held ? finalReport(ctx, l.token_id) : null,
      chainNow(ctx),
    ]);
    const reclaim_at = l.paid_at ? (BigInt(l.paid_at) + RECLAIM_AFTER_NS).toString() : null;
    const reverse_at = l.name_at ? (BigInt(l.name_at) + CLEARING_TIMEOUT_NS).toString() : null;
    const timedOut = l.state !== "Verified" && reverse_at !== null && BigInt(now) >= BigInt(reverse_at);
    const awaiting = l.state === "NameHeld" && !!final && final.fingerprint !== l.accepted_fingerprint;
    const party = !!caller && (caller === l.seller || caller === l.buyer);
    return {
      listing: l,
      report,
      final_report: final,
      awaiting_buyer: awaiting,
      reclaim_at,
      reverse_at,
      now,
      can: {
        delist: l.state === "Listed" && caller === l.seller,
        pay: l.state === "Listed" && !!caller && caller !== l.seller,
        cancel: l.state === "Paid" && caller === l.buyer,
        reclaim: !!caller && l.state === "Paid" && reclaim_at !== null && BigInt(now) >= BigInt(reclaim_at),
        hand_over: l.state === "Paid" && caller === l.seller,
        accept_changed: awaiting && caller === l.buyer,
        reverse: !!caller && held && (l.failure !== null || timedOut),
        finish: party && held && !awaiting && l.failure === null,
      },
    };
  },
};

type Handler = (caller: string, args: unknown) => unknown;
const token = z.string().min(1).max(128);
const byName = z.object({ name: token });
const byId = z.object({ id: z.string().regex(/^\d{1,20}$/) });

function method<S extends z.ZodType>(schema: S, run: (caller: string, args: z.infer<S>) => unknown): Handler {
  return async (caller, args) => {
    const parsed = schema.parse(args);
    // Public RPC connections drop now and then, so a failed read gets one more try.
    for (let attempt = 0; ; attempt++) {
      try {
        return await run(caller, parsed);
      } catch (error) {
        if (error instanceof Refusal) throw error;
        if (attempt === 1) throw new Refusal("ATTO couldn't reach NEAR just now. Try again in a moment.");
      }
    }
  };
}

/** Read methods only. Writes go from the browser to the visitor's wallet. */
export const MAINNET_METHODS: Record<string, Handler> = {
  getReport: method(byName, (_, a) => mainnet.getReport(a.name)),
  getHistory: method(byName, (_, a) => mainnet.getHistory(a.name)),
  changedOwner: method(z.object({ name: token, days: z.number() }), (_, a) => mainnet.changedOwner(a.name, a.days)),
  sampleNames: method(z.object({}), () => mainnet.sampleNames()),
  config: method(z.object({}), () => mainnet.config()),
  ownedBy: method(z.object({}), (c) => mainnet.ownedBy(c)),
  openSales: method(z.object({}), () => mainnet.openSales()),
  mySales: method(z.object({}), (c) => mainnet.mySales(c)),
  getSale: method(byId, (c, a) => mainnet.getSale(c, a.id)),
  listingFor: method(z.object({ token_id: token }), (_, a) => mainnet.listingFor(a.token_id)),
  finalReport: method(byName, (_, a) => mainnet.finalReport(a.name)),
};
