export * from "./store";
import { parseAttoEvent } from "@atto/shared";
import { Rpc, nsDate } from "../../title-search/src/rpc";
import { HistoryStore } from "./store";
export interface Outcome {
  id: string;
  executor_id: string;
  logs: string[];
  status?: unknown;
  receipt_ids?: string[];
}
function succeeded(status: unknown) {
  return !!status && typeof status === "object" && ("SuccessValue" in status || "SuccessReceiptId" in status);
}
const EVENTS = new Set([
  "listed",
  "paid",
  "name_received",
  "manifest_posted",
  "cleared",
  "verified",
  "check_failed",
  "completed",
  "reversed",
  "cancelled",
  "configured",
  "topped_up",
  "pulled",
  "renewed",
  "renew_failed",
  "withdrawn",
]);
export function ingestOutcomes(
  store: HistoryStore,
  outcomes: Outcome[],
  block: { height: number; timestamp_nanosec: string },
  allowed: Set<string>,
  network = "unknown",
) {
  const time = nsDate(block.timestamp_nanosec);
  for (const outcome of outcomes) {
    if (!allowed.has(outcome.executor_id) || !succeeded(outcome.status)) continue;
    for (const [index, log] of outcome.logs.entries()) {
      const atto = parseAttoEvent(log);
      if (!atto) {
        if (!log.startsWith("EVENT_JSON:")) continue;
        try {
          const v = JSON.parse(log.slice(11));
          if (v.standard === "hos_tla_registry" && Array.isArray(v.data)) {
            const kinds: Record<string, string> = {
              sub_account_rented: "minted",
              sub_account_re_rented: "re_rented",
              sub_account_transferred: "transferred",
              sub_account_recovered: "transferred",
              sub_account_reclaimed: "reclaimed",
              sub_account_renewed: "renewed",
            };
            const kind = kinds[v.event];
            if (!kind) continue;
            for (const [i, d] of v.data.entries()) {
              if (!d || typeof d.full_name !== "string") continue;
              store.append({
                id: `${outcome.id}:${index}:${i}`,
                token_id: d.full_name,
                kind,
                from_owner: typeof d.from === "string" ? d.from : null,
                to_owner: typeof d.to === "string" ? d.to : typeof d.owner === "string" ? d.owner : null,
                block_height: block.height,
                block_time: time,
                tx_hash: null,
                details: { ...d, receipt_id: outcome.id, registry_event: v.event, network },
              });
            }
            continue;
          }
          if (v.standard !== "nep171" || !Array.isArray(v.data)) continue;
          const kinds: Record<string, string> = { nft_transfer: "transferred", nft_mint: "minted", nft_burn: "burned" };
          const kind = kinds[v.event];
          if (!kind) continue;
          for (const [i, d] of v.data.entries()) {
            if (!d || !Array.isArray(d.token_ids)) continue;
            for (const token of d.token_ids) {
              if (typeof token !== "string") continue;
              store.append({
                id: `${outcome.id}:${index}:${i}:${token}`,
                token_id: token,
                kind,
                from_owner:
                  typeof d.old_owner_id === "string"
                    ? d.old_owner_id
                    : typeof d.owner_id === "string" && kind === "burned"
                      ? d.owner_id
                      : null,
                to_owner:
                  typeof d.new_owner_id === "string"
                    ? d.new_owner_id
                    : typeof d.owner_id === "string" && kind === "minted"
                      ? d.owner_id
                      : null,
                block_height: block.height,
                block_time: time,
                tx_hash: null,
                details: { ...d, receipt_id: outcome.id, network },
              });
            }
          }
        } catch {}
        continue;
      }
      if (!EVENTS.has(atto.event) || !atto.data || typeof atto.data !== "object") continue;
      const data = atto.data as unknown as Record<string, unknown>;
      const token = data.token_id ?? data.name;
      if (typeof token !== "string" || !token) continue;
      if ("listing_id" in data && typeof data.listing_id !== "string") continue;
      if (
        atto.event === "completed" &&
        (typeof data.seller !== "string" || typeof data.buyer !== "string" || typeof data.price !== "string")
      )
        continue;
      const kind =
        atto.event === "completed" ? "sold_clean" : atto.event === "renewed" ? "renewed_by_keeper" : atto.event;
      store.append({
        id: `${outcome.id}:${index}`,
        token_id: token,
        kind,
        from_owner: typeof data.seller === "string" ? data.seller : null,
        to_owner: typeof data.buyer === "string" ? data.buyer : null,
        block_height: block.height,
        block_time: time,
        tx_hash: null,
        details: { ...data, receipt_id: outcome.id, network },
      });
    }
  }
}
export async function followBlock(rpc: Rpc, store: HistoryStore, height: number) {
  const prior = store.cursor("blocks");
  const head = await rpc.call<{ header: { height: number } }>("block", { finality: "final" });
  if (height > head.header.height) throw new Error("Follower only ingests finalized blocks.");
  const block = await rpc.call<{
    header: { height: number; timestamp_nanosec: string; prev_height: number; prev_hash: string };
    chunks: { chunk_hash: string }[];
  }>("block", { block_id: height });
  if (prior !== null) {
    const previous = await rpc.call<{ header: { height: number } }>("block", { block_id: block.header.prev_hash });
    if (previous.header.height !== prior) throw new Error("Follower must ingest linked canonical blocks without gaps.");
  }
  const allowed = new Set(
    [rpc.accounts.registry, rpc.accounts.escrow, rpc.accounts.keeper].filter((s): s is string => !!s),
  );
  for (const chunk of block.chunks) {
    const c = await rpc.call<{ transactions: { hash: string; signer_id: string }[] }>("chunk", {
      chunk_id: chunk.chunk_hash,
    });
    for (const tx of c.transactions ?? []) {
      const result = await rpc.call<{
        receipts_outcome: {
          id: string;
          block_hash: string;
          outcome: { executor_id: string; logs: string[]; status: unknown };
        }[];
      }>("tx", { tx_hash: tx.hash, sender_account_id: tx.signer_id, wait_until: "FINAL" });
      for (const receipt of result.receipts_outcome ?? []) {
        if (!allowed.has(receipt.outcome.executor_id) || !succeeded(receipt.outcome.status)) continue;
        const executed = await rpc.call<{ header: { height: number; timestamp_nanosec: string } }>("block", {
          block_id: receipt.block_hash,
        });
        ingestOutcomes(store, [{ id: receipt.id, ...receipt.outcome }], executed.header, allowed, rpc.network);
      }
    }
  }
  store.db
    .prepare("UPDATE coverage SET through=?,complete=CASE WHEN since<=? THEN 1 ELSE 0 END")
    .run(nsDate(block.header.timestamp_nanosec), nsDate(block.header.timestamp_nanosec));
  store.setCursor("blocks", height);
}
