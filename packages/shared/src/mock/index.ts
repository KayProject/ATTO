import { fingerprint } from "../manifest";
import type { Manifest } from "../manifest";
import type { Listing, Reserve } from "../contracts";
import { RECLAIM_AFTER_NS, CLEARING_TIMEOUT_NS } from "../contracts";
import type { AttoEvent } from "../events";

export class MockEscrow {
  listings = new Map<string, Listing>();
  events: AttoEvent[] = [];
  keys = new Map<string, string[]>();
  balances = new Map<string, Record<string, string>>();
  approvals = new Map<string, string[]>();
  nftOwners = new Map<string, string>();
  owners = new Map<string, string>();
  payouts = new Map<string, bigint>();
  private nextId = 0;
  constructor(
    public registry = "registry.demo",
    public escrow = "escrow.demo",
    public now = () => BigInt(Date.now()) * 1_000_000n,
  ) {}
  private emit(event: AttoEvent["event"], data: object) {
    this.events.push({ standard: "atto", version: "1.0.0", event, data } as AttoEvent);
  }
  get_listing({ listing_id }: { listing_id: string }) {
    const l = this.listings.get(listing_id);
    return l ? structuredClone(l) : null;
  }
  listing_for_token({ token_id }: { token_id: string }) {
    return (
      [...this.listings.values()].find(
        (l) => l.token_id === token_id && !["Completed", "Reversed", "Cancelled"].includes(l.state),
      ) ?? null
    );
  }
  listings_for({ account_id }: { account_id: string }) {
    return [...this.listings.values()]
      .filter((l) => l.seller === account_id || l.buyer === account_id)
      .map((l) => structuredClone(l));
  }
  private get(id: string, states: string[]) {
    const l = this.listings.get(id);
    if (!l || !states.includes(l.state)) throw new Error("This action is unavailable in the current listing state.");
    return l;
  }
  private credit(account: string, amount: string) {
    this.payouts.set(account, (this.payouts.get(account) ?? 0n) + BigInt(amount));
  }
  list(actor: string, { token_id, price }: { token_id: string; price: string }) {
    if (this.owners.get(token_id) !== actor) throw new Error("Only the registered owner can list this name.");
    if (this.listing_for_token({ token_id })) throw new Error("A listing already exists.");
    if (BigInt(price) <= 0n) throw new Error("Price must be positive.");
    const id = String(this.nextId++);
    const parts = token_id.split(".");
    this.listings.set(id, {
      id,
      token_id,
      tla_id: parts.slice(1).join("."),
      label: parts[0]!,
      seller: actor,
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
    this.emit("listed", { listing_id: id, token_id, seller: actor, price });
    return id;
  }
  pay(actor: string, { listing_id, fingerprint: hash }: { listing_id: string; fingerprint: string }, deposit: string) {
    const l = this.get(listing_id, ["Listed"]);
    if (deposit !== l.price || actor === l.seller || !/^[a-f0-9]{64}$/.test(hash))
      throw new Error("Payment or report fingerprint is invalid.");
    l.buyer = actor;
    l.accepted_fingerprint = hash;
    l.paid_at = this.now().toString();
    l.state = "Paid";
    this.emit("paid", { listing_id, token_id: l.token_id, buyer: actor, price: l.price, fingerprint: hash });
  }
  receive(caller: string, sender: string, token: string, id: string) {
    const l = this.listings.get(id);
    if (caller !== this.registry || !l || l.state !== "Paid" || sender !== l.seller || token !== l.token_id)
      return true;
    this.owners.set(token, this.escrow);
    l.state = "NameHeld";
    l.name_at = this.now().toString();
    this.emit("name_received", { listing_id: id, token_id: token });
    return false;
  }
  post_manifest(actor: string, { listing_id, manifest }: { listing_id: string; manifest: Manifest }) {
    const l = this.get(listing_id, ["NameHeld"]);
    if (manifest.token_id !== l.token_id) throw new Error("Manifest belongs to another name.");
    const hash = fingerprint(manifest);
    if (hash !== l.accepted_fingerprint && actor !== l.buyer)
      throw new Error("The final report changed. Only the buyer can accept it.");
    if (l.cleared_upto) throw new Error("Clearing already started.");
    l.manifest = structuredClone(manifest);
    l.accepted_fingerprint = hash;
    l.state = "Clearing";
    this.emit("manifest_posted", {
      listing_id,
      token_id: l.token_id,
      fingerprint: hash,
      accepted_by_buyer: actor === l.buyer,
    });
  }
  clear({ listing_id, count }: { listing_id: string; count: number }) {
    const l = this.get(listing_id, ["Clearing"]);
    if (!Number.isInteger(count) || count < 1 || count > 10 || !l.manifest)
      throw new Error("Choose a page of one to ten items.");
    const m = l.manifest;
    const items = [...m.intents_keys.map((k) => ({ key: k })), ...m.nfts.map((n) => ({ nft: n }))].slice(
      l.cleared_upto,
      l.cleared_upto + count,
    );
    const keys: string[] = [];
    const nfts: Manifest["nfts"] = [];
    for (const i of items) {
      if ("key" in i) {
        keys.push(i.key);
        this.keys.set(
          l.token_id,
          (this.keys.get(l.token_id) ?? []).filter((k) => k !== i.key),
        );
      } else {
        nfts.push(i.nft);
        this.approvals.set(`${i.nft.contract_id}/${i.nft.token_id}`, []);
      }
    }
    l.cleared_upto += items.length;
    this.emit("cleared", { listing_id, token_id: l.token_id, keys_removed: keys, nfts_revoked: nfts });
  }
  verify({ listing_id }: { listing_id: string }) {
    const l = this.get(listing_id, ["Clearing"]);
    const m = l.manifest!;
    if (l.cleared_upto !== m.intents_keys.length + m.nfts.length)
      throw new Error("Clear every manifest item before verifying.");
    let reason: string | null = null;
    if (this.owners.get(l.token_id) !== this.escrow) reason = "Escrow no longer owns the name.";
    else if ((this.keys.get(l.token_id) ?? []).length) reason = "Intents signing keys remain.";
    else if (m.intents_floor.some((t) => BigInt(this.balances.get(l.token_id)?.[t.token_id] ?? "0") < BigInt(t.amount)))
      reason = "An Intents balance fell below the accepted report.";
    else if (m.nfts.some((n) => this.nftOwners.get(`${n.contract_id}/${n.token_id}`) !== l.token_id))
      reason = "An accepted NFT is no longer owned by the name.";
    else if (m.nfts.some((n) => (this.approvals.get(`${n.contract_id}/${n.token_id}`) ?? []).length))
      reason = "NFT approvals remain.";
    if (reason) {
      l.failure = reason;
      this.emit("check_failed", { listing_id, token_id: l.token_id, reason });
      return false;
    }
    l.state = "Verified";
    this.emit("verified", { listing_id, token_id: l.token_id });
    return true;
  }
  complete({ listing_id }: { listing_id: string }) {
    const l = this.get(listing_id, ["Verified"]);
    this.owners.set(l.token_id, l.buyer!);
    this.credit(l.seller, l.price);
    l.state = "Completed";
    this.emit("completed", { listing_id, token_id: l.token_id, seller: l.seller, buyer: l.buyer, price: l.price });
  }
  reverse({ listing_id }: { listing_id: string }) {
    const l = this.get(listing_id, ["NameHeld", "Clearing"]);
    if (!l.failure && this.now() - BigInt(l.name_at!) < CLEARING_TIMEOUT_NS)
      throw new Error("No failed check or clearing timeout.");
    this.owners.set(l.token_id, l.seller);
    this.credit(l.buyer!, l.price);
    l.state = "Reversed";
    this.emit("reversed", { listing_id, token_id: l.token_id, reason: l.failure ?? "Clearing timed out." });
  }
  cancel(actor: string, { listing_id }: { listing_id: string }) {
    const l = this.get(listing_id, ["Paid"]);
    if (actor !== l.buyer) throw new Error("Only the buyer can cancel.");
    this.credit(actor, l.price);
    l.state = "Cancelled";
    this.emit("cancelled", { listing_id, token_id: l.token_id, refunded: l.buyer });
  }
  delist(actor: string, { listing_id }: { listing_id: string }) {
    const l = this.get(listing_id, ["Listed"]);
    if (actor !== l.seller) throw new Error("Only the seller can delist.");
    l.state = "Cancelled";
    this.emit("cancelled", { listing_id, token_id: l.token_id, refunded: null });
  }
  reclaim_payment(actor: string, args: { listing_id: string }) {
    const l = this.get(args.listing_id, ["Paid"]);
    if (this.now() - BigInt(l.paid_at!) < RECLAIM_AFTER_NS)
      throw new Error("The 48-hour payment timeout has not elapsed.");
    this.cancel(l.buyer!, args);
  }
}
export class MockKeeper {
  reserves = new Map<string, Reserve & { collector: string; ready: boolean }>();
  events: AttoEvent[] = [];
  owners = new Map<string, string>();
  collectors = new Map<string, bigint>();
  grants = new Map<string, { receiver: string; budget: bigint; spent: bigint; expires: bigint }>();
  leases = new Map<string, { expires: bigint; rent: bigint }>();
  constructor(public now = () => BigInt(Date.now()) * 1_000_000n) {}
  private emit(event: AttoEvent["event"], data: object) {
    this.events.push({ standard: "atto", version: "1.0.0", event, data } as AttoEvent);
  }
  private reserve(name: string) {
    const reserve = this.reserves.get(name);
    if (!reserve?.ready) throw new Error("Prepare the name collector first.");
    return reserve;
  }
  prepare(actor: string, { name }: { name: string }, deposit: string) {
    if (this.owners.get(name) !== actor) throw new Error("Only the name owner may prepare a collector.");
    if (deposit !== "2100000000000000000000000" || this.reserves.has(name))
      throw new Error("Prepare requires the exact setup deposit and an unprepared name.");
    const collector = `${fingerprint({ token_id: name, intents_keys: [], intents_floor: [], nfts: [], needs_seller: [] }).slice(0, 24)}.keeper.demo`;
    this.reserves.set(name, {
      name,
      balance: "0",
      enabled: false,
      share_bps: 0,
      puller: actor,
      last_spent_seen: "0",
      collector,
      ready: true,
    });
    this.collectors.set(name, 0n);
    return collector;
  }
  get_reserve({ name }: { name: string }) {
    return structuredClone(this.reserves.get(name) ?? null);
  }
  configure(name: string, args: { enabled: boolean; share_bps: number; puller: string }) {
    if (!Number.isInteger(args.share_bps) || args.share_bps < 0 || args.share_bps > 10000)
      throw new Error("Share must be between zero and 100%.");
    const r = this.reserve(name);
    Object.assign(r, args);
    this.emit("configured", { name, ...args });
  }
  top_up({ name }: { name: string }, deposit: string) {
    if (BigInt(deposit) <= 0n) throw new Error("Top-up must be positive.");
    const r = this.reserve(name);
    r.balance = (BigInt(r.balance) + BigInt(deposit)).toString();
    this.emit("topped_up", { name, by: "funder.demo", amount: deposit });
  }
  pull(actor: string, { name, amount }: { name: string; amount: string }) {
    const r = this.reserve(name),
      g = this.grants.get(name);
    if (
      actor !== r.puller ||
      !r.enabled ||
      !g ||
      g.receiver !== r.collector ||
      g.expires <= this.now() ||
      BigInt(amount) <= 0n ||
      g.spent + BigInt(amount) > g.budget
    )
      throw new Error("The collector grant does not allow this pull.");
    g.spent += BigInt(amount);
    this.collectors.set(name, (this.collectors.get(name) ?? 0n) + BigInt(amount));
    this.emit("pulled", { name, amount });
  }
  sync({ name }: { name: string }) {
    const r = this.reserve(name),
      received = this.collectors.get(name) ?? 0n;
    r.balance = (BigInt(r.balance) + received).toString();
    this.collectors.set(name, 0n);
  }
  withdraw(name: string, { amount }: { amount: string }) {
    const r = this.reserve(name);
    if (BigInt(amount) < 0n || BigInt(amount) > BigInt(r.balance)) throw new Error("Reserve is too small.");
    r.balance = (BigInt(r.balance) - BigInt(amount)).toString();
    this.emit("withdrawn", { name, amount });
  }
  due_soon() {
    return [...this.reserves]
      .filter(
        ([name, r]) => r.enabled && (this.leases.get(name)?.expires ?? 0n) <= this.now() + 30n * 86400n * 1000000000n,
      )
      .map(([name]) => name);
  }
  renew({ name }: { name: string }) {
    const r = this.reserve(name),
      lease = this.leases.get(name);
    if (
      !lease ||
      !r.enabled ||
      lease.expires > this.now() + 30n * 86400n * 1000000000n ||
      BigInt(r.balance) < lease.rent
    )
      throw new Error("Reserve or renewal window does not allow renewal.");
    r.balance = (BigInt(r.balance) - lease.rent).toString();
    lease.expires += 365n * 86400n * 1000000000n;
    this.emit("renewed", { name, paid: lease.rent.toString(), new_expires_at: lease.expires.toString() });
  }
}
