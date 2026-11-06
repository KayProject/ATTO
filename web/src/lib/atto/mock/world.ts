// An in-memory stand-in for the escrow, Keeper, Title Search and history store.
// The sale methods follow contracts/escrow/src/lib.rs: same states, same refusals.
// `botStep` plays the part of services/bot.
import {
  CLEARING_TIMEOUT_NS,
  fingerprint,
  RATING_LABEL,
  RECLAIM_AFTER_NS,
  RENEW_MARGIN_BPS,
  RENEW_WINDOW_NS,
  SALE_WINDOW_NS,
  SECTION_KEYS,
  TERMINAL_STATES,
  type Listing,
  type Manifest,
  type Rating,
  type Report,
  type ReportLine,
  type ReportSection,
  type Reserve,
  type SectionKey,
} from "@atto/shared";
import { changedAnswer } from "../check";
import { formatDate, formatNear, parseNear } from "../format";
import type {
  ChangedAnswer,
  HandOverResult,
  HistoryEvent,
  OwnedName,
  OwnerView,
  ReportSummary,
  SaleView,
} from "../types";
import { ESCROW_ACCOUNT, LATE_KEY, SEEDS, type NameSeed } from "./seeds";

const DAY_MS = 24 * 3600 * 1000;
const GRACE_DAYS = 30;
/** Same as the escrow: the bot clears at most this many items per call. The mock uses 1 so each cut shows. */
const BOT_PAGE = 1;
const KEEPER_PULLER = "bot.atto.near";

/** A move the contract or service would refuse. The message reaches the page as written. */
export class Refusal extends Error {}
const refuse = (why: string): never => {
  throw new Refusal(why);
};
const near = (text: string) => parseNear(text) ?? "0";

interface NameState extends Omit<NameSeed, "lease_days" | "wallet_near" | "rent_near" | "reserve" | "history"> {
  lease_end_ms: number;
  owner_since_ms: number;
  rent: string;
  wallet: string;
  payout: string;
  reserve: Reserve | null;
}

interface SaleExtra {
  accepted: Report | null;
  final: Report | null;
  awaiting_buyer: boolean;
  keys_removed: string[];
  nfts_revoked: { contract_id: string; token_id: string }[];
}

export class World {
  private now_ms: number;
  private names = new Map<string, NameState>();
  private listings = new Map<string, Listing>();
  private extras = new Map<string, SaleExtra>();
  private events: HistoryEvent[] = [];
  private next_listing = 1;
  private next_event = 1;

  constructor(start = new Date("2026-11-06T12:00:00Z")) {
    this.now_ms = start.getTime();
    for (const seed of SEEDS) {
      const { lease_days, owner_since_days, rent_near, wallet_near, reserve, history, ...rest } = seed;
      this.names.set(seed.token_id, {
        ...rest,
        owner_since_days,
        lease_end_ms: this.now_ms + lease_days * DAY_MS,
        owner_since_ms: this.now_ms - owner_since_days * DAY_MS,
        rent: near(rent_near),
        wallet: near(wallet_near),
        payout: seed.owner,
        reserve: reserve
          ? {
              name: seed.token_id,
              balance: near(reserve.balance_near),
              enabled: reserve.enabled,
              share_bps: reserve.share_bps,
              puller: KEEPER_PULLER,
              last_spent_seen: "0",
            }
          : null,
      });
      for (const h of history) {
        this.record(seed.token_id, h.kind, h.from, h.to, this.now_ms - h.days_ago * DAY_MS, { note: h.note });
      }
    }
  }

  // ---------- clock ----------

  private nowNs(): string {
    return (BigInt(this.now_ms) * 1_000_000n).toString();
  }
  /** Mock tool: moves time forward so the 48-hour and 24-hour rules can be seen. */
  advanceClock(hours: number) {
    if (!(hours > 0)) refuse("hours must be positive");
    this.now_ms += hours * 3600 * 1000;
  }
  nowIso() {
    return new Date(this.now_ms).toISOString();
  }

  // ---------- reads ----------

  sampleNames() {
    return ["bakery.food", "clean.pay", "guild.food", "corner.cafe"];
  }

  private name(token_id: string): NameState {
    return this.names.get(token_id) ?? refuse(`${token_id} isn't in the mock data`);
  }

  getReport(token_id: string, final = false): Report | null {
    const n = this.names.get(token_id);
    return n ? this.buildReport(n, final) : null;
  }

  getHistory(token_id: string): HistoryEvent[] {
    return this.events
      .filter((e) => e.token_id === token_id)
      .sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime() || b.id - a.id);
  }

  changedOwner(token_id: string, days: number): ChangedAnswer | null {
    if (!this.names.has(token_id)) return null;
    return changedAnswer(this.getHistory(token_id), days, new Date(this.now_ms));
  }

  ownedBy(caller: string): OwnedName[] {
    return [...this.names.values()]
      .filter((n) => n.owner === caller)
      .map((n) => ({
        name: n.token_id,
        lease_end: new Date(n.lease_end_ms).toISOString(),
        listing_id: this.openListingFor(n.token_id)?.id ?? null,
        clean_sale: n.business_reason ? { supported: false, reason: n.business_reason } : { supported: true },
      }));
  }

  openSales(): Listing[] {
    return [...this.listings.values()].filter((l) => l.state === "Listed");
  }

  mySales(caller: string): Listing[] {
    return [...this.listings.values()].filter((l) => l.seller === caller || l.buyer === caller).reverse();
  }

  private openListingFor(token_id: string) {
    return [...this.listings.values()].find((l) => l.token_id === token_id && !TERMINAL_STATES.includes(l.state));
  }

  getSale(caller: string, id: string): SaleView | null {
    const l = this.listings.get(id);
    if (!l) return null;
    const x = this.extras.get(id)!;
    const paid = l.paid_at ? BigInt(l.paid_at) : null;
    const held = l.name_at ? BigInt(l.name_at) : null;
    const reclaim_at = paid !== null ? (paid + RECLAIM_AFTER_NS).toString() : null;
    const reverse_at = held !== null ? (held + CLEARING_TIMEOUT_NS).toString() : null;
    const now = BigInt(this.nowNs());
    const isHeld = l.state === "NameHeld" || l.state === "Clearing" || l.state === "Verified";
    const timedOut = l.state !== "Verified" && reverse_at !== null && now >= BigInt(reverse_at);
    return {
      listing: l,
      report: x.accepted ?? this.buildReport(this.name(l.token_id), false),
      final_report: x.final,
      awaiting_buyer: x.awaiting_buyer,
      reclaim_at,
      reverse_at,
      now: this.nowNs(),
      can: {
        delist: l.state === "Listed" && caller === l.seller,
        pay: l.state === "Listed" && caller !== l.seller,
        cancel: l.state === "Paid" && caller === l.buyer,
        reclaim: l.state === "Paid" && reclaim_at !== null && now >= BigInt(reclaim_at),
        hand_over: l.state === "Paid" && caller === l.seller,
        accept_changed: x.awaiting_buyer && caller === l.buyer,
        reverse: isHeld && (l.failure !== null || timedOut),
      },
    };
  }

  // ---------- escrow ----------

  list(caller: string, token_id: string, price: string): string {
    if (BigInt(price) <= 0n) refuse("price must be positive");
    if (this.openListingFor(token_id)) refuse("name already listed");
    const n = this.name(token_id);
    if (n.owner !== caller) refuse("only the owner can list");
    if (n.business_reason) refuse(n.business_reason);
    if (n.lease_end_ms * 1_000_000 < Number(BigInt(this.nowNs()) + SALE_WINDOW_NS)) {
      refuse("lease ends inside the sale window");
    }
    const id = String(this.next_listing++);
    const [label = "", ...rest] = token_id.split(".");
    this.listings.set(id, {
      id,
      token_id,
      tla_id: rest.join("."),
      label,
      seller: caller,
      price,
      state: "Listed",
      buyer: null,
      accepted_fingerprint: null,
      manifest: null,
      cleared_upto: 0,
      paid_at: null,
      name_at: null,
      failure: null,
    });
    this.extras.set(id, { accepted: null, final: null, awaiting_buyer: false, keys_removed: [], nfts_revoked: [] });
    return id;
  }

  private listing(id: string): Listing {
    return this.listings.get(id) ?? refuse("no such listing");
  }
  private extra(id: string): SaleExtra {
    return this.extras.get(id)!;
  }

  delist(caller: string, id: string) {
    const l = this.listing(id);
    if (caller !== l.seller) refuse("only the seller");
    if (l.state !== "Listed") refuse("only before payment");
    l.state = "Cancelled";
  }

  pay(caller: string, id: string, fp: string) {
    if (!/^[0-9a-f]{64}$/.test(fp)) refuse("fingerprint must be 64 hex chars");
    const l = this.listing(id);
    if (l.state !== "Listed") refuse("listing is not open");
    if (caller === l.seller) refuse("seller cannot buy");
    const report = this.buildReport(this.name(l.token_id), false);
    if (report.fingerprint !== fp) refuse("The report changed since you read it. Read the new report before paying.");
    l.state = "Paid";
    l.buyer = caller;
    l.accepted_fingerprint = fp;
    l.paid_at = this.nowNs();
    this.extra(id).accepted = report;
  }

  cancel(caller: string, id: string) {
    const l = this.listing(id);
    if (l.buyer !== caller) refuse("only the buyer");
    this.refundUnpaidHandover(l);
  }

  reclaimPayment(id: string) {
    const l = this.listing(id);
    const paid = l.paid_at ? BigInt(l.paid_at) : 0n;
    if (BigInt(this.nowNs()) < paid + RECLAIM_AFTER_NS) refuse("wait 48 hours after paying");
    this.refundUnpaidHandover(l);
  }

  private refundUnpaidHandover(l: Listing) {
    if (l.state !== "Paid") refuse("name already handed over or not paid");
    l.state = "Cancelled";
  }

  /** `nft_transfer_call` with `msg` = listing id. A failed check sends the name straight back. */
  handOver(caller: string, id: string): HandOverResult {
    const l = this.listings.get(id);
    if (!l) return { accepted: false, reason: "no such listing" };
    const n = this.name(l.token_id);
    if (n.owner !== caller) refuse("only the owner can send the name");
    if (l.seller !== caller) return { accepted: false, reason: "this listing belongs to another seller" };
    if (l.state !== "Paid") return { accepted: false, reason: "the buyer hasn't paid, so the name went back to you" };

    if (n.scenario === "changed") n.intents_keys = [...n.intents_keys, { key: LATE_KEY, before_owner: false }];
    this.record(l.token_id, "transferred", caller, ESCROW_ACCOUNT, this.now_ms, { note: `Handed to the escrow for sale ${id}.` });
    // A change of owner sweeps the wallet's NEAR to the old payout account.
    n.wallet = "0";
    n.owner = ESCROW_ACCOUNT;
    n.owner_since_ms = this.now_ms;
    n.payout = ESCROW_ACCOUNT;
    l.state = "NameHeld";
    l.name_at = this.nowNs();
    return { accepted: true };
  }

  acceptChangedReport(caller: string, id: string) {
    const l = this.listing(id);
    const x = this.extra(id);
    if (l.state !== "NameHeld" || !x.awaiting_buyer || !x.final) refuse("there is no changed report to accept");
    if (l.buyer !== caller) refuse("changed report needs the buyer");
    x.awaiting_buyer = false;
    l.accepted_fingerprint = x.final!.fingerprint;
    this.postManifest(l, x.final!.manifest);
  }

  private postManifest(l: Listing, manifest: Manifest) {
    l.manifest = manifest;
    l.state = "Clearing";
    // T3: the seller's key is still live until it is cleared, so they can empty Intents now.
    const n = this.name(l.token_id);
    if (n.scenario === "drain") n.intents_balances = n.intents_balances.map((b) => ({ ...b, amount: "0" }));
  }

  /** Runs one step of the bot's work. Returns false when there is nothing for it to do. */
  botStep(id: string): boolean {
    const l = this.listing(id);
    const x = this.extra(id);
    const n = this.name(l.token_id);
    if (l.failure !== null && l.state !== "Reversed") {
      this.reverse(id);
      return false;
    }
    switch (l.state) {
      case "NameHeld": {
        if (x.awaiting_buyer) return false;
        x.final = this.buildReport(n, true);
        if (x.final.fingerprint === l.accepted_fingerprint) {
          this.postManifest(l, x.final.manifest);
          return true;
        }
        x.awaiting_buyer = true;
        return false;
      }
      case "Clearing": {
        const m = l.manifest!;
        const total = m.intents_keys.length + m.nfts.length;
        if (l.cleared_upto < total) {
          this.clearItems(l, x, n, BOT_PAGE);
          return true;
        }
        const failure = this.check(l, n);
        if (failure) l.failure = failure;
        else l.state = "Verified";
        return true;
      }
      case "Verified":
        this.complete(id);
        return false;
      default:
        return false;
    }
  }

  private clearItems(l: Listing, x: SaleExtra, n: NameState, count: number) {
    const m = l.manifest!;
    const upto = Math.min(l.cleared_upto + count, m.intents_keys.length + m.nfts.length);
    for (let i = l.cleared_upto; i < upto; i++) {
      const key = m.intents_keys[i];
      if (key !== undefined) {
        n.intents_keys = n.intents_keys.filter((k) => k.key !== key);
        x.keys_removed.push(key);
      } else {
        const ref = m.nfts[i - m.intents_keys.length]!;
        n.nfts = n.nfts.map((nft) =>
          nft.contract_id === ref.contract_id && nft.token_id === ref.token_id ? { ...nft, approved: [] } : nft,
        );
        x.nfts_revoked.push(ref);
      }
    }
    l.cleared_upto = upto;
  }

  private check(l: Listing, n: NameState): string | null {
    if (n.owner !== ESCROW_ACCOUNT) return "the escrow no longer holds the name";
    if (n.intents_keys.length) return `Intents keys remain: ${n.intents_keys.map((k) => k.key).join(", ")}`;
    for (const want of l.manifest!.intents_floor) {
      const have = n.intents_balances.find((b) => b.token_id === want.token_id);
      if (BigInt(have?.amount ?? "0") < BigInt(want.amount)) {
        return `Intents balance of ${want.token_id} fell below what the buyer was shown`;
      }
    }
    return null;
  }

  private complete(id: string) {
    const l = this.listing(id);
    const x = this.extra(id);
    const n = this.name(l.token_id);
    if (l.state !== "Verified") refuse("not verified");
    n.owner = l.buyer!;
    n.payout = l.buyer!;
    n.owner_since_ms = this.now_ms;
    l.state = "Completed";
    this.record(l.token_id, "sold_clean", l.seller, l.buyer, this.now_ms, {
      sale: {
        listing_id: id,
        price: l.price,
        accepted_report: x.accepted ? summary(x.accepted) : null,
        final_report: x.final ? summary(x.final) : null,
        keys_removed: x.keys_removed,
        nfts_revoked: x.nfts_revoked,
      },
    });
  }

  /** Allowed once a check failed, or 24 hours after handover if the sale never verified. */
  reverse(id: string) {
    const l = this.listing(id);
    const held = l.state === "NameHeld" || l.state === "Clearing" || l.state === "Verified";
    if (!held) refuse("nothing to reverse");
    const deadline = BigInt(l.name_at ?? "0") + CLEARING_TIMEOUT_NS;
    const timedOut = l.state !== "Verified" && BigInt(this.nowNs()) >= deadline;
    if (l.failure === null && !timedOut) refuse("no failed check and not timed out");
    if (l.failure === null) l.failure = "timed out before verification";
    const n = this.name(l.token_id);
    n.owner = l.seller;
    n.payout = l.seller;
    n.owner_since_ms = this.now_ms;
    l.state = "Reversed";
    this.extra(id).awaiting_buyer = false;
    this.record(l.token_id, "transferred", ESCROW_ACCOUNT, l.seller, this.now_ms, {
      note: `Sale ${id} reversed: ${l.failure}. The name went back to the seller and the payment to the buyer.`,
    });
  }

  // ---------- keeper ----------

  private ownerOnly(caller: string, token_id: string): NameState {
    const n = this.name(token_id);
    if (n.owner !== caller) refuse("Only the current owner can do this.");
    return n;
  }

  private reserveOf(n: NameState): Reserve {
    n.reserve ??= {
      name: n.token_id,
      balance: "0",
      enabled: false,
      share_bps: 0,
      puller: KEEPER_PULLER,
      last_spent_seen: "0",
    };
    return n.reserve;
  }

  getOwnerView(caller: string, token_id: string): OwnerView {
    const n = this.ownerOnly(caller, token_id);
    const reserve = this.reserveOf(n);
    const renewal_cost = renewalCost(n.rent);
    const missing = BigInt(renewal_cost) - BigInt(reserve.balance);
    const opens = n.lease_end_ms - Number(RENEW_WINDOW_NS / 1_000_000n);
    return {
      name: token_id,
      owner: n.owner,
      lease_end: new Date(n.lease_end_ms).toISOString(),
      rent: n.rent,
      reserve: { ...reserve },
      renewal_cost,
      shortfall: missing > 0n ? missing.toString() : "0",
      renew_window_opens: new Date(opens).toISOString(),
      can_renew: this.now_ms >= opens && missing <= 0n,
      grant_cap: n.rent,
      report: this.buildReport(n, false),
    };
  }

  configureKeeper(caller: string, token_id: string, enabled: boolean, share_bps: number) {
    const n = this.ownerOnly(caller, token_id);
    if (!Number.isInteger(share_bps) || share_bps < 0 || share_bps > 10_000) refuse("share must be between 0% and 100%");
    const r = this.reserveOf(n);
    r.enabled = enabled;
    r.share_bps = share_bps;
  }

  topUp(token_id: string, amount: string) {
    const n = this.name(token_id);
    if (BigInt(amount) <= 0n) refuse("amount must be positive");
    const r = this.reserveOf(n);
    r.balance = (BigInt(r.balance) + BigInt(amount)).toString();
  }

  withdraw(caller: string, token_id: string, amount: string) {
    const n = this.ownerOnly(caller, token_id);
    const r = this.reserveOf(n);
    if (BigInt(amount) <= 0n) refuse("amount must be positive");
    if (BigInt(amount) > BigInt(r.balance)) refuse("That's more than the reserve holds.");
    r.balance = (BigInt(r.balance) - BigInt(amount)).toString();
    n.wallet = (BigInt(n.wallet) + BigInt(amount)).toString();
  }

  renew(token_id: string) {
    const n = this.name(token_id);
    const r = this.reserveOf(n);
    const opens = n.lease_end_ms - Number(RENEW_WINDOW_NS / 1_000_000n);
    if (this.now_ms < opens) refuse("Renewal opens 30 days before the lease ends.");
    if (BigInt(r.balance) < BigInt(renewalCost(n.rent))) refuse("The reserve doesn't cover the next renewal.");
    r.balance = (BigInt(r.balance) - BigInt(n.rent)).toString();
    n.lease_end_ms += 365 * DAY_MS;
    this.record(token_id, "renewed_by_keeper", null, null, this.now_ms, {
      note: `Paid ${formatNear(n.rent)} NEAR from the reserve.`,
    });
  }

  // ---------- reports ----------

  private buildReport(n: NameState, final: boolean): Report {
    const manifest: Manifest = {
      token_id: n.token_id,
      intents_keys: n.intents_keys.map((k) => k.key),
      intents_floor: n.intents_balances.filter((b) => BigInt(b.amount) > 0n),
      nfts: n.nfts.map(({ contract_id, token_id }) => ({ contract_id, token_id })),
      needs_seller: [
        ...(n.signed_only ? ["Intents is set to signed messages only"] : []),
        ...n.dao_roles.map((d) => `DAO role ${d.role} in ${d.dao}`),
        ...n.sub_accounts.map((s) => `sub-account ${s.account} has ${s.keys} access key${s.keys === 1 ? "" : "s"}`),
      ],
    };
    const keysLen = n.intents_keys.length;

    const sections: Record<SectionKey, ReportSection> = {
      owner: filled("Owner", [
        line("Current owner", `${n.owner}, since ${formatDate(new Date(n.owner_since_ms))}`, "Clean"),
      ]),
      lease: filled("Lease", [
        line("Lease ends", formatDate(new Date(n.lease_end_ms)), "Clean"),
        line("Grace period ends", formatDate(new Date(n.lease_end_ms + GRACE_DAYS * DAY_MS)), "Clean"),
        line("Next renewal", `${formatNear(n.rent)} NEAR`, "Clean"),
      ]),
      wallet: {
        ...filled("Wallet", [line("NEAR in the wallet", `${formatNear(n.wallet)} NEAR`, "Clean")]),
        note: "In any sale, the wallet's NEAR goes to the seller's payout account, not to the buyer.",
      },
      intents_balances: section(
        "Intents balances",
        n.intents_balances.map((b) => line(b.token_id, `${formatNear(b.amount)} held inside NEAR Intents`, "Clean")),
      ),
      intents_keys: section(
        "Intents keys",
        n.intents_keys.map((k, i) =>
          line(
            k.key,
            k.before_owner ? "Added before the current owner took over" : "Added by the current owner",
            "WillBeCleared",
            { data: { manifest_index: i } },
          ),
        ),
      ),
      intents_mode: filled("Intents mode", [
        n.signed_only
          ? line("Signed messages only", "Nobody can remove this name's Intents keys by direct call.", "NeedsSeller", {
              ask_seller: "Ask the seller to switch Intents back to allow direct calls before listing.",
            })
          : line("Direct calls allowed", "A new owner can manage this name's Intents keys.", "Clean"),
      ]),
      nfts: section(
        "NFTs and approvals",
        n.nfts.map((nft, i) =>
          nft.approved.length
            ? line(`${nft.contract_id} #${nft.token_id}`, `${nft.approved.join(", ")} may move this NFT`, "WillBeCleared", {
                data: { manifest_index: keysLen + i },
              })
            : line(`${nft.contract_id} #${nft.token_id}`, "No other account may move this NFT", "Clean"),
        ),
      ),
      dao_roles: section(
        "DAO roles",
        n.dao_roles.map((d) =>
          line(`${d.role} in ${d.dao}`, `This role can ${d.can}.`, "NeedsSeller", {
            ask_seller: `Ask the seller to leave this role, or ask ${d.dao} to remove the name.`,
          }),
        ),
      ),
      sub_accounts: section(
        "Sub-accounts",
        n.sub_accounts.map((s) =>
          line(s.account, `${s.keys} access key${s.keys === 1 ? "" : "s"} held by someone else`, "NeedsSeller", {
            ask_seller: `Ask the seller to delete ${s.account} or hand you its keys. Customers may still pay it.`,
          }),
        ),
      ),
      name_keys: { title: "The name's own keys", status: "none_found", lines: [], note: "A rented name should have none." },
      keeper_reserve: section(
        "Keeper reserve",
        n.reserve
          ? [line("Rent set aside", `${formatNear(n.reserve.balance)} NEAR. It stays with the name in a sale.`, "Clean")]
          : [],
      ),
      history: filled("History", [
        line(
          "Recorded events",
          `${this.getHistory(n.token_id).length} on this name's history page`,
          "Clean",
        ),
      ]),
    };

    const counts: Record<Rating, number> = { Clean: 0, WillBeCleared: 0, NeedsSeller: 0 };
    for (const key of SECTION_KEYS) for (const l of sections[key].lines) counts[l.rating]++;

    return {
      name: n.token_id,
      network: "sandbox",
      built_at: this.nowIso(),
      final,
      sources: ["ATTO mock data"],
      sections,
      counts,
      clean_sale: n.business_reason ? { supported: false, reason: n.business_reason } : { supported: true },
      manifest,
      fingerprint: fingerprint(manifest),
    };
  }

  private record(
    token_id: string,
    kind: HistoryEvent["kind"],
    from_owner: string | null,
    to_owner: string | null,
    at_ms: number,
    extra: Pick<HistoryEvent, "note" | "sale"> = {},
  ) {
    const id = this.next_event++;
    this.events.push({
      id,
      token_id,
      kind,
      from_owner,
      to_owner,
      block_time: new Date(at_ms).toISOString(),
      tx_hash: `mock-tx-${id}`,
      ...extra,
    });
  }
}

function line(label: string, detail: string, rating: Rating, more: Partial<ReportLine> = {}): ReportLine {
  return { label, detail, rating, ...more };
}
function filled(title: string, lines: ReportLine[]): ReportSection {
  return { title, status: "filled", lines };
}
function section(title: string, lines: ReportLine[]): ReportSection {
  return { title, status: lines.length ? "filled" : "none_found", lines };
}
function summary(r: Report): ReportSummary {
  return { fingerprint: r.fingerprint, built_at: r.built_at, counts: r.counts };
}
export function renewalCost(rent: string): string {
  return ((BigInt(rent) * (10_000n + RENEW_MARGIN_BPS)) / 10_000n).toString();
}

export { RATING_LABEL };
