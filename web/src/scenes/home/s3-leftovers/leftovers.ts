// The six leftovers a name can carry, and how many of each a report shows.
import type { Report, SectionKey } from "@atto/shared";
import type { GlassName } from "../assets";
import type { Cord } from "@/scenes/tag/cords";

export type LeftoverId = "keys" | "nfts" | "balance" | "dao" | "subs" | "mode";

/** "clears": ATTO removes it during the sale. "seller": the seller handles it. "travels": it goes to the buyer with the name. */
export type LeftoverStamp = "clears" | "seller" | "travels";

export interface Leftover {
  id: LeftoverId;
  section: SectionKey;
  name: string;
  stamp: LeftoverStamp;
  object: GlassName;
  /** The cord on the tag that stands for it, if any. */
  cord: Cord["object"] | null;
  lines: [string, string];
}

export const STAMP_LABEL: Record<LeftoverStamp, string> = {
  clears: "ATTO clears",
  seller: "Seller fixes",
  travels: "Goes with the name",
};

/** The credits printed on each poster, like an album's label and release date. */
export const CREDITS: Record<LeftoverStamp, { by: string; when: string }> = {
  clears: { by: "ATTO", when: "During the sale" },
  seller: { by: "The seller", when: "Before listing" },
  travels: { by: "The buyer", when: "With the name" },
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
      "Keys the previous owner can use to move the name's funds in NEAR Intents.",
      "ATTO removes every one during the sale.",
    ],
  },
  {
    id: "nfts",
    section: "nfts",
    name: "NFT approvals",
    stamp: "clears",
    object: "nft-frame",
    cord: "nft",
    lines: [
      "Permission for another account to transfer NFTs the name owns.",
      "ATTO revokes them during the sale.",
    ],
  },
  {
    id: "balance",
    section: "intents_balances",
    name: "Intents balance",
    stamp: "travels",
    object: "coin",
    cord: null,
    lines: [
      "Funds the name holds in NEAR Intents.",
      "They stay with the name and go to the buyer.",
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
      "Roles the name holds in a DAO, a group that votes on a shared treasury.",
      "They're on the report, so the buyer sees them before paying.",
    ],
  },
  {
    id: "subs",
    section: "sub_accounts",
    name: "Sub-accounts",
    stamp: "seller",
    object: "subaccount-tag",
    cord: "subaccount",
    lines: [
      "Accounts created under the name.",
      "They're listed for the seller to hand over or close.",
    ],
  },
  {
    id: "mode",
    section: "intents_mode",
    name: "Account settings",
    stamp: "seller",
    object: "mode-switch",
    cord: "mode",
    lines: [
      "An Intents setting that stops keys from being removed directly.",
      "The seller switches it off before listing.",
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
