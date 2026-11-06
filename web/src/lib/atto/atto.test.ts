import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import vectors from "../../../../packages/shared/vectors/manifest.json";
import { changedAnswer } from "./check";
import { formatNear, parseNear } from "./format";
import { PERSONAS } from "./mock/seeds";
import { Refusal, World } from "./mock/world";
import { nep413Hash, verifyNep413 } from "./nep413";
import { keeperSetupCalls } from "../keeper-setup";

const SELLER = PERSONAS.seller.account;
const BUYER = PERSONAS.buyer.account;
const OWNER = PERSONAS.owner.account;
const STRANGER = PERSONAS.stranger.account;
const PRICE = parseNear("100")!;

function drain(world: World, id: string) {
  for (let i = 0; i < 20 && world.botStep(id); i++);
}
function listAndPay(world: World, name: string) {
  const id = world.list(SELLER, name, PRICE);
  world.pay(BUYER, id, world.getReport(name)!.fingerprint);
  return id;
}

describe("mock reports", () => {
  it("uses real fingerprints that match the shared vectors", () => {
    const world = new World();
    expect(world.getReport("bakery.food")!.fingerprint).toBe(vectors.dirty.fingerprint);
    expect(world.getReport("clean.pay")!.fingerprint).toBe(vectors.empty.fingerprint);
  });

  it("fills or marks every section, never blank", () => {
    const report = new World().getReport("clean.pay")!;
    for (const section of Object.values(report.sections)) {
      expect(section.status === "none_found" || section.lines.length > 0).toBe(true);
    }
  });

  it("says the wallet's NEAR goes to the seller", () => {
    expect(new World().getReport("bakery.food")!.sections.wallet.note).toContain("seller");
  });
});

describe("mock escrow", () => {
  it("walks a dirty name to Completed and clears its leftovers", () => {
    const world = new World();
    const id = listAndPay(world, "bakery.food");
    expect(world.handOver(SELLER, id).accepted).toBe(true);
    drain(world, id);
    const sale = world.getSale(BUYER, id)!;
    expect(sale.listing.state).toBe("Completed");
    const after = world.getReport("bakery.food")!;
    expect(after.manifest.intents_keys).toEqual([]);
    expect(after.sections.owner.lines[0]!.detail).toContain(BUYER);
    expect(after.sections.nfts.lines[0]!.rating).toBe("Clean");
    const sold = world.getHistory("bakery.food")[0]!;
    expect(sold.kind).toBe("sold_clean");
    expect(sold.sale!.keys_removed).toHaveLength(1);
    expect(sold.sale!.accepted_report!.fingerprint).toBe(vectors.dirty.fingerprint);
    expect(sold.sale!.final_report).not.toBeNull();
  });

  it("reverses when a held key drains Intents in the gap", () => {
    const world = new World();
    const id = listAndPay(world, "tea.shop");
    world.handOver(SELLER, id);
    drain(world, id);
    world.botStep(id);
    const sale = world.getSale(BUYER, id)!;
    expect(sale.listing.state).toBe("Reversed");
    expect(sale.listing.failure).toContain("fell below");
    expect(world.getReport("tea.shop")!.sections.owner.lines[0]!.detail).toContain(SELLER);
  });

  it("makes a changed report wait for the buyer, with no instant refund", () => {
    const world = new World();
    const id = listAndPay(world, "lamp.store");
    world.handOver(SELLER, id);
    drain(world, id);
    expect(world.getSale(BUYER, id)!.awaiting_buyer).toBe(true);
    expect(() => world.acceptChangedReport(STRANGER, id)).toThrow("changed report needs the buyer");
    expect(() => world.reverse(id)).toThrow("not timed out");
    world.advanceClock(24);
    expect(world.getSale(BUYER, id)!.can.reverse).toBe(true);
    world.reverse(id);
    expect(world.getSale(BUYER, id)!.listing.failure).toBe("timed out before verification");
  });

  it("finishes the sale once the buyer accepts a changed report", () => {
    const world = new World();
    const id = listAndPay(world, "lamp.store");
    world.handOver(SELLER, id);
    drain(world, id);
    world.acceptChangedReport(BUYER, id);
    drain(world, id);
    expect(world.getSale(BUYER, id)!.listing.state).toBe("Completed");
    expect(world.getHistory("lamp.store")[0]!.sale!.keys_removed).toHaveLength(2);
  });

  it("refuses wrong moves", () => {
    const world = new World();
    expect(() => world.list(STRANGER, "bakery.food", PRICE)).toThrow("only the owner");
    expect(() => world.list(SELLER, "lastweek.food", PRICE)).toThrow("sale window");
    expect(() => world.list(SELLER, "acme.corp", PRICE)).toThrow(Refusal);
    const id = world.list(SELLER, "bakery.food", PRICE);
    expect(() => world.list(SELLER, "bakery.food", PRICE)).toThrow("already listed");
    expect(() => world.pay(SELLER, id, vectors.dirty.fingerprint)).toThrow("seller cannot buy");
    expect(() => world.pay(BUYER, id, "00")).toThrow("64 hex");
    expect(() => world.pay(BUYER, id, "0".repeat(64))).toThrow("report changed");
  });

  it("sends the name straight back when nobody has paid", () => {
    const world = new World();
    const id = world.list(SELLER, "clean.pay", PRICE);
    expect(world.handOver(SELLER, id).accepted).toBe(false);
    expect(world.getReport("clean.pay")!.sections.owner.lines[0]!.detail).toContain(SELLER);
  });

  it("lets the buyer cancel, and reclaim only after 48 hours", () => {
    const world = new World();
    const a = listAndPay(world, "clean.pay");
    expect(() => world.cancel(STRANGER, a)).toThrow("only the buyer");
    world.cancel(BUYER, a);
    expect(world.getSale(BUYER, a)!.listing.state).toBe("Cancelled");
    const b = listAndPay(world, "clean.pay");
    expect(() => world.reclaimPayment(b)).toThrow("48 hours");
    world.advanceClock(48);
    world.reclaimPayment(b);
    expect(world.getSale(BUYER, b)!.listing.state).toBe("Cancelled");
  });
});

describe("mock keeper", () => {
  it("opens the owner view only for the owner", () => {
    const world = new World();
    expect(() => world.getOwnerView(STRANGER, "harbor.pay")).toThrow("Only the current owner");
    expect(world.getOwnerView(OWNER, "harbor.pay").name).toBe("harbor.pay");
  });

  it("renews only inside the window, taking the rent from the reserve", () => {
    const world = new World();
    expect(() => world.renew("harbor.pay")).toThrow("30 days");
    const before = world.getOwnerView(OWNER, "orchard.food");
    world.renew("orchard.food");
    const after = world.getOwnerView(OWNER, "orchard.food");
    expect(BigInt(before.reserve.balance) - BigInt(after.reserve.balance)).toBe(BigInt(before.rent));
    expect(new Date(after.lease_end).getTime()).toBeGreaterThan(new Date(before.lease_end).getTime());
  });

  it("shows a shortfall and refuses a renewal the reserve can't cover", () => {
    const world = new World();
    const view = world.getOwnerView(OWNER, "sunrise.food");
    expect(BigInt(view.shortfall)).toBeGreaterThan(0n);
    world.advanceClock(24 * 10);
    expect(() => world.renew("sunrise.food")).toThrow("doesn't cover");
  });

  it("lets only the owner withdraw, and never more than the reserve", () => {
    const world = new World();
    expect(() => world.withdraw(STRANGER, "harbor.pay", PRICE)).toThrow("Only the current owner");
    expect(() => world.withdraw(OWNER, "harbor.pay", PRICE)).toThrow("more than the reserve");
    world.withdraw(OWNER, "harbor.pay", parseNear("4")!);
    expect(world.getOwnerView(OWNER, "harbor.pay").reserve.balance).toBe(parseNear("20"));
  });

  it("keeps the reserve with the name in a sale", () => {
    const world = new World();
    world.topUp("clean.pay", parseNear("5")!);
    const id = listAndPay(world, "clean.pay");
    world.handOver(SELLER, id);
    drain(world, id);
    expect(world.getOwnerView(BUYER, "clean.pay").reserve.balance).toBe(parseNear("5"));
  });
});

describe("check before you pay", () => {
  it("answers yes for a name re-rented inside the window", () => {
    const answer = new World().changedOwner("corner.cafe", 7)!;
    expect(answer).toMatchObject({ changed: true, kind: "re_rented", previous_owner: "firsttenant.near" });
    expect(answer.at).toBeDefined();
  });

  it("answers no for a stable name, a short window and renewals", () => {
    const world = new World();
    expect(world.changedOwner("harbor.pay", 7)).toEqual({ changed: false });
    expect(world.changedOwner("corner.cafe", 1)).toEqual({ changed: false });
    const renewal = world.getHistory("harbor.pay");
    expect(changedAnswer(renewal, 365, new Date("2026-11-06T12:00:00Z")).changed).toBe(false);
  });

  it("returns null for an unknown name", () => {
    expect(new World().changedOwner("nobody.food", 7)).toBeNull();
  });
});

describe("format", () => {
  it("formats yocto as NEAR", () => {
    expect(formatNear("2500000000000000000000000")).toBe("2.5");
    expect(formatNear("0")).toBe("0");
    expect(formatNear("1234000000000000000000000000")).toBe("1,234");
  });

  it("parses typed amounts and rejects bad ones", () => {
    expect(parseNear("2.5")).toBe("2500000000000000000000000");
    expect(parseNear("1")).toBe("1000000000000000000000000");
    for (const bad of ["", "0", "-1", "1e3", "abc", "1.", "0.0"]) expect(parseNear(bad)).toBeNull();
  });
});

describe("NEP-413", () => {
  const payload = { message: "Open the owner page", nonce: new Uint8Array(32).fill(7), recipient: "atto.example" };
  const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const encode = (bytes: Uint8Array) => {
    let v = BigInt(`0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`);
    let out = "";
    while (v > 0n) {
      out = BASE58[Number(v % 58n)]! + out;
      v /= 58n;
    }
    return out;
  };
  const secret = ed25519.utils.randomSecretKey();
  const publicKey = `ed25519:${encode(ed25519.getPublicKey(secret))}`;
  const signature = ed25519.sign(nep413Hash(payload), secret);

  it("accepts a valid signature", () => {
    expect(verifyNep413(payload, signature, publicKey)).toBe(true);
  });

  it("refuses a changed message, a wrong key and malformed input", () => {
    expect(verifyNep413({ ...payload, message: "Something else" }, signature, publicKey)).toBe(false);
    const other = `ed25519:${encode(ed25519.getPublicKey(ed25519.utils.randomSecretKey()))}`;
    expect(verifyNep413(payload, signature, other)).toBe(false);
    expect(verifyNep413(payload, signature, "secp256k1:abc")).toBe(false);
    expect(verifyNep413(payload, new Uint8Array(3), publicKey)).toBe(false);
  });
});

describe("keeper setup", () => {
  it("caps the grant at the rent with Keeper as the only receiver", () => {
    const [, grant] = keeperSetupCalls({
      keeper: "keeper.atto.near",
      rent: "10",
      leaseEnd: "1",
      shareBps: 500,
      puller: "bot.atto.near",
    });
    expect(grant.args).toMatchObject({ receivers: ["keeper.atto.near"], budget_yocto: "10" });
  });
});
