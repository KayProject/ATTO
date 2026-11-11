// Reads served from the deployed escrow and the registry on the wallet network. Server only.
// Nothing here signs: every transaction is approved in the visitor's wallet.
import { z } from "zod";
import {
  CLEARING_TIMEOUT_NS,
  RECLAIM_AFTER_NS,
  RENEW_WINDOW_NS,
  accountsFromEnv,
  type Listing,
  type Report,
  type Reserve,
} from "@atto/shared";
import { Rpc, nsDate, splitName, titleSearch, type RegistryName } from "@atto/title-search";
import { changedAnswer } from "../check";
import { liveReport } from "../live";
import { NETWORK } from "../backend";
import { Refusal } from "../mock/world";
import {
  NOT_OWNER,
  type ChangedAnswer,
  type HistoryEvent,
  type HistoryKind,
  type KeeperState,
  type OwnedName,
  type OwnerView,
  type SaleView,
} from "../types";

const MAX_LISTINGS = 200;
const MAX_OWNED = 20;
const BATCH = 4;

function context() {
  if (!NETWORK) throw new Refusal("No NEAR network is configured for wallet mode.");
  const { accounts } = accountsFromEnv({ ...process.env, ATTO_NETWORK: NETWORK });
  if (!accounts.escrow) throw new Refusal(`The escrow isn't deployed on ${NETWORK}.`);
  return {
    rpc: new Rpc(accounts, NETWORK),
    escrow: accounts.escrow,
    registry: accounts.registry,
    keeper: accounts.keeper,
  };
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

const YEAR_NS = 365n * 24n * 3600n * 1_000_000_000n;
const REGISTRY_KINDS: Record<string, HistoryKind> = {
  sub_account_rented: "minted",
  sub_account_re_rented: "re_rented",
  sub_account_transferred: "transferred",
  sub_account_recovered: "transferred",
  sub_account_reclaimed: "reclaimed",
  sub_account_renewed: "renewed",
  nft_mint: "minted",
  nft_transfer: "transferred",
};
type Draft = Omit<HistoryEvent, "id">;
const text = (value: unknown) => (typeof value === "string" && value ? value : null);

/** Ownership events from the report's transaction history, where the network has an index. */
function indexedEvents(name: string, report: Report | null): Draft[] | null {
  const section = report?.sections.history;
  if (!section || section.status === "unavailable") return null;
  const events: Draft[] = [];
  // One transfer logs both a registry event and an NFT event, so each transaction counts once per kind.
  const seen = new Set<string>();
  for (const line of section.lines) {
    const d = line.data as Record<string, unknown> | undefined;
    const kind = d && REGISTRY_KINDS[String(d.event)];
    const at = text(d?.block_time) ?? line.label.split(" at ")[1];
    if (!d || !kind || !Number.isFinite(Date.parse(at ?? ""))) continue;
    const once = `${String(d.transaction_hash)}:${kind}`;
    if (seen.has(once)) continue;
    seen.add(once);
    events.push({
      token_id: name,
      kind,
      from_owner: text(d.old_owner_id) ?? text(d.from),
      to_owner: text(d.new_owner_id) ?? text(d.owner_id) ?? text(d.to) ?? text(d.owner),
      block_time: new Date(at!).toISOString(),
      tx_hash: text(d.transaction_hash) ?? "",
    });
  }
  return events;
}

/** The registry's own feed of recent events. It names no owners and keeps a limited number of entries. */
async function registryEvents(ctx: Ctx, name: string): Promise<Draft[]> {
  const rows = await ctx.rpc.view<{ event: string; block_timestamp: string }[]>(ctx.registry, "list_recent_activity", {
    from_index: 0,
    limit: 100,
    account: name,
  });
  return rows.flatMap((row) => {
    const kind = REGISTRY_KINDS[row.event];
    return kind
      ? [{ token_id: name, kind, from_owner: null, to_owner: null, block_time: nsDate(row.block_timestamp), tx_hash: "" }]
      : [];
  });
}

/**
 * A name's history, read from the chain on each request. A sale moves the name into the escrow
 * and out again, so those two transfers are folded into one Clean Sale entry.
 */
async function history(ctx: Ctx, name: string): Promise<{ events: HistoryEvent[]; complete: boolean }> {
  const [report, listings] = await Promise.all([liveReport(name).catch(() => null), allListings(ctx)]);
  const indexed = indexedEvents(name, report);
  let events = indexed ?? (await registryEvents(ctx, name));
  const ms = (e: Draft) => Date.parse(e.block_time);
  events.sort((a, b) => ms(a) - ms(b));
  let rented = false;
  for (const e of events) {
    if (e.kind === "minted" && rented) e.kind = "re_rented";
    if (e.kind === "minted") rented = true;
  }
  for (const l of listings) {
    if (l.token_id !== name || !l.name_at) continue;
    const held = Number(BigInt(l.name_at) / 1_000_000n);
    const transfers = events.filter((e) => e.kind === "transferred");
    const into = transfers.find((e) => Math.abs(ms(e) - held) < 60_000);
    const out = into && transfers.find((e) => ms(e) > ms(into));
    const done = l.state === "Completed";
    if (!done && l.state !== "Reversed") {
      events = events.filter((e) => e !== into);
      continue;
    }
    events = events.filter((e) => e !== into && e !== out);
    if (!done) continue;
    events.push({
      token_id: name,
      kind: "sold_clean",
      from_owner: l.seller,
      to_owner: l.buyer,
      block_time: out?.block_time ?? new Date(held).toISOString(),
      tx_hash: out?.tx_hash ?? "",
      sale: {
        listing_id: l.id,
        price: l.price,
        accepted_report: null,
        final_report: null,
        keys_removed: l.manifest?.intents_keys ?? [],
        nfts_revoked: l.manifest?.nfts ?? [],
      },
    });
  }
  events.sort((a, b) => ms(b) - ms(a));
  return {
    events: events.map((e, i) => ({ ...e, id: events.length - i })),
    // The feed is complete from the day the name was first rented, if it still holds that entry.
    complete: indexed !== null || rented,
  };
}

async function registered(ctx: Ctx, name: string) {
  const found = await ctx.rpc.view<RegistryName | null>(ctx.registry, "get_sub_account", splitName(name));
  if (!found) throw new Refusal(`${name} isn't a rented name in the registry.`);
  return found;
}

/** The next year's rent in yocto. Falls back to the registry's last exchange rate when it won't quote. */
async function nextRent(ctx: Ctx, name: string, annualRentUsdMicro: string) {
  try {
    const quote = await ctx.rpc.view<{ rent_yocto: string }>(ctx.registry, "get_rent_price", splitName(name));
    return quote.rent_yocto;
  } catch {
    const rate = BigInt(await ctx.rpc.view<string>(ctx.registry, "get_near_usd_rate"));
    return ((BigInt(annualRentUsdMicro) * 10n ** 24n) / rate).toString();
  }
}

/** Where a name's Keeper stands: its reserve, and what its wallet lets the collector do. */
async function keeperState(ctx: Ctx, caller: string, name: string): Promise<KeeperState> {
  if (!ctx.keeper) throw new Refusal(`Keeper isn't deployed on ${NETWORK} yet.`);
  const [name_, reserve, config, now] = await Promise.all([
    registered(ctx, name),
    ctx.rpc.view<(Reserve & { collector: string; ready: boolean }) | null>(ctx.keeper, "get_reserve", { name }),
    ctx.rpc.view<{ collector_setup_deposit: string }>(ctx.keeper, "config"),
    chainNow(ctx),
  ]);
  if (name_.owner !== caller) throw new Refusal(NOT_OWNER);
  const status = reserve?.ready
    ? await ctx.rpc.view<{ extension_enabled: boolean; grant: { expires_at: string } | null }>(
        name,
        "hos_agent_status",
        { extension: reserve.collector },
      )
    : null;
  const rent = await nextRent(ctx, name, name_.annual_rent);
  return {
    keeper: ctx.keeper,
    owner: name_.owner,
    lease_end_ns: name_.expires_at,
    rent,
    now,
    reserve: reserve?.ready ? reserve : null,
    collector: reserve?.ready ? reserve.collector : null,
    setup_cost: config.collector_setup_deposit,
    extension_enabled: status?.extension_enabled ?? false,
    granted: !!status?.grant && BigInt(status.grant.expires_at) > BigInt(now),
    grant_expires_ns: (BigInt(now) + YEAR_NS).toString(),
  };
}

async function ownerView(ctx: Ctx, caller: string, name: string): Promise<OwnerView> {
  const [state, report] = await Promise.all([keeperState(ctx, caller, name), titleSearch(name, { rpc: ctx.rpc })]);
  const reserve: Reserve = state.reserve ?? {
    name,
    balance: "0",
    enabled: false,
    share_bps: 0,
    puller: caller,
    last_spent_seen: "0",
  };
  // A renewal attaches the rent plus a 0.5% margin, which the registry refunds.
  const renewal_cost = (BigInt(state.rent) + BigInt(state.rent) / 200n).toString();
  const missing = BigInt(renewal_cost) - BigInt(reserve.balance);
  const opens = BigInt(state.lease_end_ns) - RENEW_WINDOW_NS;
  return {
    name,
    owner: state.owner,
    lease_end: nsDate(state.lease_end_ns),
    rent: state.rent,
    reserve,
    renewal_cost,
    shortfall: missing > 0n ? missing.toString() : "0",
    renew_window_opens: nsDate(opens.toString()),
    can_renew: !!state.reserve && reserve.enabled && BigInt(state.now) >= opens && missing <= 0n,
    grant_cap: state.rent,
    report,
    setup_cost: state.reserve ? undefined : state.setup_cost,
  };
}

export const mainnet = {
  getReport: (name: string) => liveReport(name),
  getHistory: async (name: string) => (await history(context(), name)).events,
  async changedOwner(name: string, days: number): Promise<ChangedAnswer | null> {
    const { events, complete } = await history(context(), name);
    if (!events.length) return null;
    const answer = changedAnswer(events, days, new Date());
    return answer.changed || complete ? answer : null;
  },
  getOwnerView: (caller: string, name: string) => ownerView(context(), caller, name),
  keeperState: (caller: string, name: string) => keeperState(context(), caller, name),
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
  getOwnerView: method(byName, (c, a) => mainnet.getOwnerView(c, a.name)),
  keeperState: method(byName, (c, a) => mainnet.keeperState(c, a.name)),
};
