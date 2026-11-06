import { describe, it, expect } from "vitest";
import { MockEscrow } from "@atto/shared/mock";
import { fingerprint, type Manifest } from "@atto/shared";
import { driveSale } from "../src/sale";
import { rate } from "../../title-search/src/rate";
import { HistoryStore, ingestOutcomes } from "../../follower/src";
const manifest: Manifest = {
  token_id: "bakery.demo",
  intents_keys: ["old-key"],
  intents_floor: [{ token_id: "nep141:token.demo", amount: "50" }],
  nfts: [{ contract_id: "nft.demo", token_id: "1" }],
  needs_seller: [],
};
function setup() {
  const e = new MockEscrow();
  e.owners.set(manifest.token_id, "seller.demo");
  e.keys.set(manifest.token_id, ["old-key"]);
  e.balances.set(manifest.token_id, { "nep141:token.demo": "50" });
  e.approvals.set("nft.demo/1", ["seller.demo"]);
  e.nftOwners.set("nft.demo/1", manifest.token_id);
  const id = e.list("seller.demo", { token_id: manifest.token_id, price: "100" });
  e.pay("buyer.demo", { listing_id: id, fingerprint: fingerprint(manifest) }, "100");
  e.receive(e.registry, "seller.demo", manifest.token_id, id);
  return { e, id };
}
describe("local sale and Check API proof", () => {
  it("bot clears retained keys and approvals, preserves balance, completes to buyer", async () => {
    const { e, id } = setup();
    const report = {
      ...rate(manifest.token_id, "sandbox", {}, []),
      manifest,
      fingerprint: fingerprint(manifest),
      clean_sale: { supported: true },
    };
    const result = await driveSale(
      {
        getListing: async (id) => e.get_listing({ listing_id: id }),
        report: async () => report,
        postManifest: async (id, r) => e.post_manifest("bot.demo", { listing_id: id, manifest: r.manifest }),
        clear: async (id, count) => e.clear({ listing_id: id, count }),
        verify: async (id) => {
          e.verify({ listing_id: id });
        },
        complete: async (id) => e.complete({ listing_id: id }),
        reverse: async (id) => e.reverse({ listing_id: id }),
      },
      id,
    );
    expect(result.state).toBe("Completed");
    expect(e.keys.get(manifest.token_id)).not.toContain("old-key");
    expect(e.approvals.get("nft.demo/1")).toEqual([]);
    expect(e.owners.get(manifest.token_id)).toBe("buyer.demo");
    expect(e.payouts.get("seller.demo")).toBe(100n);
  });
  it("a drained Intents balance reverses the name and refunds the buyer", () => {
    const { e, id } = setup();
    e.post_manifest("bot.demo", { listing_id: id, manifest });
    e.clear({ listing_id: id, count: 10 });
    e.balances.set(manifest.token_id, { "nep141:token.demo": "49" });
    expect(e.verify({ listing_id: id })).toBe(false);
    e.reverse({ listing_id: id });
    expect(e.get_listing({ listing_id: id })?.state).toBe("Reversed");
    expect(e.owners.get(manifest.token_id)).toBe("seller.demo");
    expect(e.payouts.get("buyer.demo")).toBe(100n);
  });
  it("stores successful events, ignores failed and unknown ownership events, and never treats missing coverage as unchanged", () => {
    const db = new HistoryStore(":memory:");
    const event = {
      standard: "nep171",
      version: "1.0.0",
      event: "nft_transfer",
      data: [{ token_ids: ["bakery.demo"], old_owner_id: "seller.demo", new_owner_id: "buyer.demo" }],
    };
    const block = { height: 1, timestamp_nanosec: (BigInt(Date.now()) * 1000000n).toString() };
    const outcome = {
      id: "receipt-1",
      executor_id: "registry.demo",
      logs: [`EVENT_JSON:${JSON.stringify(event)}`],
      status: { SuccessValue: "" },
    };
    ingestOutcomes(db, [outcome], block, new Set(["registry.demo"]));
    expect(db.changed("bakery.demo", 7).changed).toBe(true);
    expect(db.changed("other.demo", 7).changed).toBe(null);
    ingestOutcomes(
      db,
      [
        {
          ...outcome,
          id: "failed",
          status: { Failure: {} },
          logs: [`EVENT_JSON:${JSON.stringify({ ...event, data: [{ token_ids: ["other.demo"] }] })}`],
        },
      ],
      block,
      new Set(["registry.demo"]),
    );
    expect(db.history("other.demo")).toEqual([]);
    expect(() => db.changed("other.demo", 0)).toThrow();
    const now = Date.now();
    db.setCoverage("other.demo", new Date(now - 8 * 86400000).toISOString(), new Date(now).toISOString(), true);
    expect(db.changed("other.demo", 7, now).changed).toBe(false);
    expect(db.changed("other.demo", 7, now + 61000).changed).toBe(null);
    db.close();
  });
});
