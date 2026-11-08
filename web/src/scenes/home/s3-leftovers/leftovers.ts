// The six leftovers a name can carry, and how many of each a report shows.
import type { Report, SectionKey } from "@atto/shared";
import type { CastKind } from "@/scenes/tag/cast";
import type { Cord } from "@/scenes/tag/cords";

export type LeftoverId = "keys" | "nfts" | "balance" | "dao" | "subs" | "mode";

/** "clears": ATTO removes it in a Clean Sale. "seller": only the seller can. "travels": it goes to the buyer with the name. */
export type LeftoverStamp = "clears" | "seller" | "travels";

export interface Leftover {
  id: LeftoverId;
  section: SectionKey;
  name: string;
  stamp: LeftoverStamp;
  object: CastKind;
  /** The cord on the tag that stands for it, if any. */
  cord: Cord["object"] | null;
  lines: [string, string];
}

export const STAMP_LABEL: Record<LeftoverStamp, string> = {
  clears: "ATTO clears",
  seller: "Seller fixes",
  travels: "Goes with the name",
};

export const LEFTOVERS: Leftover[] = [
  {
    id: "keys",
    section: "intents_keys",
    name: "Intents keys",
    stamp: "clears",
    object: "key",
    cord: "key",
    lines: [
      "Signing keys the old owner left in NEAR Intents.",
      "They can move what the name holds there. ATTO removes every one in a Clean Sale.",
    ],
  },
  {
    id: "nfts",
    section: "nfts",
    name: "NFT approvals",
    stamp: "clears",
    object: "nft",
    cord: "nft",
    lines: [
      "Permission for another account to move the name's NFTs.",
      "ATTO revokes them in a Clean Sale, before the name changes hands.",
    ],
  },
  {
    id: "balance",
    section: "intents_balances",
    name: "Intents balance",
    stamp: "travels",
    object: "vault",
    cord: null,
    lines: [
      "What the name holds inside NEAR Intents.",
      "It moves with the name's account to the buyer. The escrow checks none of it left early.",
    ],
  },
  {
    id: "dao",
    section: "dao_roles",
    name: "DAO roles",
    stamp: "seller",
    object: "seal",
    cord: "seal",
    lines: [
      "Seats the name holds in a DAO and its shared treasury.",
      "Only the seller or the DAO can remove them. ATTO shows every one.",
    ],
  },
  {
    id: "subs",
    section: "sub_accounts",
    name: "Sub-accounts",
    stamp: "seller",
    object: "subaccount",
    cord: "subaccount",
    lines: [
      "Accounts the name created under itself. Customers may still pay them.",
      "Only the seller can hand them over or close them.",
    ],
  },
  {
    id: "mode",
    section: "intents_mode",
    name: "Signed-messages mode",
    stamp: "seller",
    object: "mode",
    cord: "mode",
    lines: [
      "An Intents setting that blocks removing keys by direct call.",
      "Only the seller can switch it back before a sale.",
    ],
  },
];

/** How many of a section's lines still hold the name, or null when the section couldn't be read. */
export function tally(report: Report, section: SectionKey): number | null {
  const found = report.sections[section];
  if (found.status === "unavailable") return null;
  if (section === "intents_balances") return found.lines.length;
  return found.lines.filter((line) => line.rating !== "Clean").length;
}

/** The three counts the hero shows beside the tag. */
export function heroCounts(report: Report) {
  return {
    keys: tally(report, "intents_keys"),
    nfts: tally(report, "nfts"),
    seller: report.counts.NeedsSeller,
  };
}

/** The cords as the corner tag should draw them while one leftover is open. */
export function answerCords(cords: Cord[], open: Leftover | null): Cord[] {
  if (!open || open.stamp !== "clears") return cords;
  return cords.map((cord) => (cord.kind === "clears" && cord.object === open.cord ? { ...cord, cut: true } : cord));
}

/** What the scene says back when a leftover opens: cut, still tied, or none on this name. */
export function answerFor(report: Report, cords: Cord[], open: Leftover): "cut" | "tied" | "travels" | "none" | "unread" {
  const count = tally(report, open.section);
  if (count === null) return "unread";
  if (open.stamp === "travels") return count > 0 ? "travels" : "none";
  const has = cords.some((cord) => cord.object === open.cord);
  if (!has) return "none";
  return open.stamp === "clears" ? "cut" : "tied";
}
