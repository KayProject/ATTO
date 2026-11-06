// The frontend's view of ATTO's data. Pages only use `AttoClient`, so moving from
// the mock to the real services and contracts means swapping one implementation.
import type { Listing, Rating, Report, Reserve } from "@atto/shared";

export type HistoryKind =
  | "minted"
  | "transferred"
  | "sold_clean"
  | "renewed"
  | "renewed_by_keeper"
  | "reclaimed"
  | "re_rented";

export interface ReportSummary {
  fingerprint: string;
  built_at: string;
  counts: Record<Rating, number>;
}

export interface HistoryEvent {
  id: number;
  token_id: string;
  kind: HistoryKind;
  from_owner: string | null;
  to_owner: string | null;
  block_time: string;
  tx_hash: string;
  note?: string;
  sale?: {
    listing_id: string;
    price: string;
    accepted_report: ReportSummary | null;
    final_report: ReportSummary | null;
    keys_removed: string[];
    nfts_revoked: { contract_id: string; token_id: string }[];
  };
}

export interface ChangedAnswer {
  changed: boolean;
  at?: string;
  kind?: HistoryKind;
  previous_owner?: string | null;
}

/** What the current account may do to a sale right now. */
export interface SaleActions {
  delist: boolean;
  pay: boolean;
  cancel: boolean;
  reclaim: boolean;
  hand_over: boolean;
  accept_changed: boolean;
  reverse: boolean;
}

export interface SaleView {
  listing: Listing;
  /** The report on offer before payment, then the one the buyer accepted. */
  report: Report;
  /** Built after the handover. Null until then. */
  final_report: Report | null;
  /** The final report differs from the accepted one and waits for the buyer. */
  awaiting_buyer: boolean;
  reclaim_at: string | null;
  reverse_at: string | null;
  now: string;
  can: SaleActions;
}

export interface OwnedName {
  name: string;
  lease_end: string;
  listing_id: string | null;
  clean_sale: { supported: boolean; reason?: string };
}

export interface OwnerView {
  name: string;
  owner: string;
  lease_end: string;
  rent: string;
  reserve: Reserve;
  /** The rent plus the 0.5% margin a renewal attaches. */
  renewal_cost: string;
  /** Yocto missing from the reserve, "0" when covered. */
  shortfall: string;
  renew_window_opens: string;
  can_renew: boolean;
  grant_cap: string;
  report: Report;
}

export interface HandOverResult {
  accepted: boolean;
  reason?: string;
}

export interface AttoClient {
  getReport(name: string): Promise<Report | null>;
  getHistory(name: string): Promise<HistoryEvent[]>;
  changedOwner(name: string, days: number): Promise<ChangedAnswer | null>;
  sampleNames(): Promise<string[]>;

  ownedBy(): Promise<OwnedName[]>;
  openSales(): Promise<Listing[]>;
  mySales(): Promise<Listing[]>;
  getSale(id: string): Promise<SaleView | null>;

  list(token_id: string, price: string): Promise<string>;
  delist(id: string): Promise<void>;
  pay(id: string, fingerprint: string): Promise<void>;
  cancel(id: string): Promise<void>;
  reclaimPayment(id: string): Promise<void>;
  handOver(id: string): Promise<HandOverResult>;
  acceptChangedReport(id: string): Promise<void>;
  reverse(id: string): Promise<void>;

  getOwnerView(name: string): Promise<OwnerView>;
  configureKeeper(name: string, enabled: boolean, share_bps: number): Promise<void>;
  topUp(name: string, amount: string): Promise<void>;
  withdraw(name: string, amount: string): Promise<void>;
  renew(name: string): Promise<void>;
}
