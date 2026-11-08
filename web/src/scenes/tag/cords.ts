// Turns a report into the cords drawn from the glass tag: one per leftover, plus one for anything unreadable.
import type { Report } from "@atto/shared";
import { platLinks, platUnread } from "@/components/report";

export type CordKind = "clears" | "seller" | "unread";

export interface Cord {
  id: string;
  label: string;
  kind: CordKind;
  /** True once the escrow has cut it. Only "clears" cords are ever cut. */
  cut: boolean;
  /** The object at the cord's far end. */
  object: "key" | "nft" | "seal" | "subaccount" | "mode" | "unknown";
}

function objectFor(id: string): Cord["object"] {
  if (id.startsWith("intents_keys:")) return "key";
  if (id.startsWith("nfts:")) return "nft";
  if (id.startsWith("dao_roles:")) return "seal";
  if (id.startsWith("sub_accounts:")) return "subaccount";
  if (id.startsWith("intents_mode:")) return "mode";
  return "unknown";
}

export function cordsFor(report: Report, clearedUpto = 0): Cord[] {
  const cords: Cord[] = platLinks(report, clearedUpto).map((link) => ({
    id: link.id,
    label: link.label,
    kind: link.rating === "NeedsSeller" ? "seller" : "clears",
    cut: link.cut,
    object: objectFor(link.id),
  }));
  if (platUnread(report)) {
    cords.push({ id: "unread", label: "Couldn't read", kind: "unread", cut: false, object: "unknown" });
  }
  return cords;
}

/** A tag is only drawn clean when the report has no cords left and nothing unread. */
export function isDrawnClean(cords: Cord[]): boolean {
  return cords.every((cord) => cord.kind === "clears" && cord.cut);
}
