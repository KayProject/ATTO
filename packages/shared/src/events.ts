// Mirror of contracts/shared/src/events.rs. NEP-297, standard `atto`, version `1.0.0`.
import type { NftRef } from "./manifest";

export const EVENT_STANDARD = "atto";
export const EVENT_VERSION = "1.0.0";

export interface AttoEventData {
  listed: { listing_id: string; token_id: string; seller: string; price: string };
  paid: { listing_id: string; token_id: string; buyer: string; price: string; fingerprint: string };
  name_received: { listing_id: string; token_id: string };
  manifest_posted: { listing_id: string; token_id: string; fingerprint: string; accepted_by_buyer: boolean };
  cleared: { listing_id: string; token_id: string; keys_removed: string[]; nfts_revoked: NftRef[] };
  verified: { listing_id: string; token_id: string };
  check_failed: { listing_id: string; token_id: string; reason: string };
  completed: { listing_id: string; token_id: string; seller: string; buyer: string; price: string };
  reversed: { listing_id: string; token_id: string; reason: string };
  cancelled: { listing_id: string; token_id: string; refunded: string | null };
  configured: { name: string; enabled: boolean; share_bps: number; puller: string };
  topped_up: { name: string; by: string; amount: string };
  pulled: { name: string; amount: string };
  renewed: { name: string; paid: string; new_expires_at: string };
  renew_failed: { name: string; attempted: string };
  withdrawn: { name: string; amount: string };
}

export type AttoEventName = keyof AttoEventData;

export type AttoEvent = {
  [K in AttoEventName]: { standard: "atto"; version: string; event: K; data: AttoEventData[K] };
}[AttoEventName];

const PREFIX = "EVENT_JSON:";

/** Parses one log line into an ATTO event, or null if it is not one. */
export function parseAttoEvent(log: string): AttoEvent | null {
  if (!log.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(log.slice(PREFIX.length));
    return parsed?.standard === EVENT_STANDARD ? (parsed as AttoEvent) : null;
  } catch {
    return null;
  }
}

export function formatAttoEvent<K extends AttoEventName>(event: K, data: AttoEventData[K]): string {
  return PREFIX + JSON.stringify({ standard: EVENT_STANDARD, version: EVENT_VERSION, event, data });
}
