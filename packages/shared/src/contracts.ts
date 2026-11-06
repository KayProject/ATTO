// Method names, arguments and return shapes of the escrow and Keeper.
// Amounts and timestamps are decimal strings (U128 / U64 on the Rust side).
import type { Manifest } from "./manifest";

export type ListingState =
  | "Listed"
  | "Paid"
  | "NameHeld"
  | "Clearing"
  | "Verified"
  | "Completed"
  | "Reversed"
  | "Cancelled";

export const TERMINAL_STATES: ListingState[] = ["Completed", "Reversed", "Cancelled"];

export interface Listing {
  id: string;
  token_id: string;
  tla_id: string;
  label: string;
  seller: string;
  price: string;
  state: ListingState;
  buyer: string | null;
  accepted_fingerprint: string | null;
  manifest: Manifest | null;
  /** Index of the next manifest item `clear` will act on. */
  cleared_upto: number;
  paid_at: string | null;
  name_at: string | null;
  failure: string | null;
}

export const SALE_WINDOW_NS = 72n * 3600n * 1_000_000_000n;
export const RECLAIM_AFTER_NS = 48n * 3600n * 1_000_000_000n;
export const CLEARING_TIMEOUT_NS = 24n * 3600n * 1_000_000_000n;
export const RENEW_WINDOW_NS = 30n * 24n * 3600n * 1_000_000_000n;
export const RENEW_MARGIN_BPS = 50n;

/**
 * Escrow methods. Who may call each is in ARCHITECTURE.md 6.1.
 * Deposits: `pay` attaches exactly `price`; calls marked 1yN attach one yoctoNEAR.
 */
export interface EscrowMethods {
  list(args: { token_id: string; price: string }): string; // 1yN, returns listing id
  delist(args: { listing_id: string }): void; // 1yN
  pay(args: { listing_id: string; fingerprint: string }): void; // attaches price
  cancel(args: { listing_id: string }): void; // 1yN
  reclaim_payment(args: { listing_id: string }): void; // 1yN
  post_manifest(args: { listing_id: string; manifest: Manifest }): void;
  clear(args: { listing_id: string; count: number }): void;
  verify(args: { listing_id: string }): void;
  complete(args: { listing_id: string }): void;
  reverse(args: { listing_id: string }): void;
  // views
  get_listing(args: { listing_id: string }): Listing | null;
  listings_for(args: { account_id: string; from_index?: number; limit?: number }): Listing[];
  listing_for_token(args: { token_id: string }): Listing | null;
}

/** NEP-171 receiver: the seller calls `nft_transfer_call` on the registry with `msg` = listing id. */
export const HANDOVER_MSG = (listingId: string) => listingId;

export interface Reserve {
  name: string;
  balance: string;
  enabled: boolean;
  share_bps: number;
  puller: string;
  last_spent_seen: string;
}

export interface KeeperMethods {
  configure(args: { enabled: boolean; share_bps: number; puller: string }): void; // called by the name
  top_up(args: { name: string }): void; // attaches NEAR
  pull(args: { name: string; amount: string }): void; // puller only
  sync(args: { name: string }): void;
  renew(args: { name: string }): void;
  collect_refunds(): void;
  withdraw(args: { amount: string }): void; // called by the name
  // views
  get_reserve(args: { name: string }): Reserve | null;
  due_soon(args: { from_index?: number; limit?: number; within_ns?: string }): string[];
}
