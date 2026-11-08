import { describe, expect, it } from "vitest";
import { World } from "@/lib/atto/mock/world";
import { cordsFor, isDrawnClean } from "@/scenes/tag/cords";
import { answerCords, answerFor, heroCounts, LEFTOVERS, tally } from "./leftovers";

const report = () => structuredClone(new World().getReport("bakery.food")!);
const find = (id: string) => LEFTOVERS.find((item) => item.id === id)!;

describe("home leftovers", () => {
  it("counts only what the report shows", () => {
    const r = report();
    const counts = heroCounts(r);
    expect(counts.keys).toBe(r.sections.intents_keys.lines.filter((l) => l.rating !== "Clean").length);
    expect(counts.seller).toBe(r.counts.NeedsSeller);
  });

  it("returns null for a section that couldn't be read", () => {
    const r = report();
    r.sections.dao_roles.status = "unavailable";
    expect(tally(r, "dao_roles")).toBeNull();
    expect(answerFor(r, cordsFor(r), find("dao"))).toBe("unread");
  });

  it("only cuts cords ATTO clears", () => {
    const r = report();
    const cords = cordsFor(r);
    const subs = answerCords(cords, find("subs"));
    expect(subs.filter((c) => c.cut)).toEqual([]);
    const keys = answerCords(cords, find("keys"));
    expect(keys.filter((c) => c.cut).every((c) => c.object === "key")).toBe(true);
    expect(isDrawnClean(answerCords(cords, find("nfts")))).toBe(false);
  });

  it("stamps only Intents keys and NFT approvals as cleared by ATTO", () => {
    expect(LEFTOVERS.filter((item) => item.stamp === "clears").map((item) => item.id)).toEqual(["keys", "nfts"]);
  });
});
