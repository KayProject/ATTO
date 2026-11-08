import { describe, expect, it } from "vitest";
import type { Cord } from "@/scenes/tag/cords";
import { journeyState } from "./model";

const cords: Cord[] = [
  { id: "key", label: "Key", kind: "clears", cut: false, object: "key" },
  { id: "nft", label: "NFT approval", kind: "clears", cut: false, object: "nft" },
  { id: "seller", label: "Sub-account", kind: "seller", cut: false, object: "subaccount" },
  { id: "unread", label: "Couldn't read", kind: "unread", cut: false, object: "unknown" },
];

describe("sale journey progress", () => {
  it("cuts clearable cords one at a time before the check", () => {
    expect(journeyState(2.8 / 5.8, cords).cleared).toBe(0);
    expect(journeyState(3.3 / 5.8, cords).cleared).toBe(1);
    expect(journeyState(3.8 / 5.8, cords).cleared).toBe(2);
    expect(journeyState(3.8 / 5.8, cords).stamped).toBe(false);
    expect(journeyState(4.1 / 5.8, cords).stamped).toBe(true);
  });
  it("reverses the cuts and stamp when scrolling back", () => {
    expect(journeyState(1, cords)).toEqual({ cleared: 2, stamped: true, stop: 5 });
    expect(journeyState(0, cords)).toEqual({ cleared: 0, stamped: false, stop: 0 });
  });
  it("does not include seller or unreadable cords in the cutting count", () => {
    expect(journeyState(1, cords.slice(2)).cleared).toBe(0);
    expect(cords.every((cord) => !cord.cut)).toBe(true);
  });
  it("clamps overscroll at either end", () => {
    expect(journeyState(-1, cords)).toEqual(journeyState(0, cords));
    expect(journeyState(2, cords)).toEqual(journeyState(1, cords));
  });
});
