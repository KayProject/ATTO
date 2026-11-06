// The Title Search report format.
import type { Manifest } from "./manifest";

export type Rating = "Clean" | "WillBeCleared" | "NeedsSeller";

export const RATING_LABEL: Record<Rating, string> = {
  Clean: "Clean",
  WillBeCleared: "Will be cleared",
  NeedsSeller: "Needs the seller",
};

export interface ReportLine {
  label: string;
  detail: string;
  rating: Rating;
  /** Present when rating is NeedsSeller: what to ask the seller to do. */
  ask_seller?: string;
  data?: Record<string, unknown>;
}

export type SectionStatus = "filled" | "none_found" | "unavailable";

export interface ReportSection {
  title: string;
  status: SectionStatus;
  lines: ReportLine[];
  /** Why a section is unavailable, or a plain note such as where NEAR goes in a sale. */
  note?: string;
}

export const SECTION_KEYS = [
  "owner",
  "lease",
  "wallet",
  "intents_balances",
  "intents_keys",
  "intents_mode",
  "nfts",
  "dao_roles",
  "sub_accounts",
  "name_keys",
  "keeper_reserve",
  "history",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface Report {
  name: string;
  network: "mainnet" | "testnet" | "sandbox";
  built_at: string;
  /** True when built after the escrow took the name, so the seller can no longer change it. */
  final: boolean;
  sources: string[];
  sections: Record<SectionKey, ReportSection>;
  counts: Record<Rating, number>;
  clean_sale: { supported: boolean; reason?: string };
  manifest: Manifest;
  fingerprint: string;
}
