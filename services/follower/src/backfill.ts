import { Rpc, splitName, nsDate } from "../../title-search/src/rpc";
import type { RegistryName } from "../../title-search/src/direct";
import { HistoryStore } from "./store";
export async function backfillRegistry(rpc: Rpc, store: HistoryStore) {
  const start = await rpc.call<{ header: { height: number; timestamp_nanosec: string } }>("block", {
    finality: "final",
  });
  const since = nsDate(start.header.timestamp_nanosec);
  let total = 0;
  for (let offset = 0; offset < 100000; offset += 100) {
    const page = await rpc.view<{ token_id: string }[]>(rpc.accounts.registry, "nft_tokens", {
      from_index: String(offset),
      limit: 100,
    });
    if (!Array.isArray(page) || page.length > 100) throw new Error("Malformed registry token page");
    for (const token of page) {
      if (typeof token.token_id !== "string") throw new Error("Malformed registry token");
      const current = await rpc.view<RegistryName | null>(
        rpc.accounts.registry,
        "get_sub_account",
        splitName(token.token_id),
      );
      if (current) {
        store.db
          .prepare("INSERT OR REPLACE INTO names VALUES(?,?,?,?,?)")
          .run(
            token.token_id,
            splitName(token.token_id).tla_id,
            current.owner,
            nsDate(current.expires_at),
            new Date().toISOString(),
          );
        if (!store.coverage(token.token_id)) store.setCoverage(token.token_id, since, since, false);
        total++;
      }
    }
    if (page.length < 100) break;
    if (offset === 99900) throw new Error("Registry backfill safety limit reached");
  }
  const activity = await rpc.view<{ account: string; event: string; block_height: string; block_timestamp: string }[]>(
    rpc.accounts.registry,
    "list_recent_activity",
    { from_index: 0, limit: 100, account: null },
  );
  if (!Array.isArray(activity)) throw new Error("Malformed recent activity feed");
  for (const item of activity) {
    if (typeof item.account !== "string" || typeof item.event !== "string") continue;
    store.append({
      id: `registry-activity:${item.block_height}:${item.account}:${item.event}`,
      token_id: item.account,
      kind: "registry_activity",
      from_owner: null,
      to_owner: null,
      block_height: Number(item.block_height),
      block_time: nsDate(item.block_timestamp),
      tx_hash: null,
      details: { event: item.event, source: "bounded registry recent activity; ownership endpoints not included" },
    });
  }
  return {
    baseline_height: start.header.height,
    names: total,
    recent_activity: activity.length,
    complete_history: false,
  };
}

export async function backfillName(rpc: Rpc, store: HistoryStore, input: string) {
  const { validateName } = await import("../../title-search/src/rpc");
  const { indexed } = await import("../../title-search/src/indexed");
  const name = validateName(input),
    discovery = await indexed(name, rpc);
  if (!discovery.coverage || discovery.sections.history?.status === "unavailable")
    throw new Error("Exhaustive finalized ownership history could not be established for this name.");
  const kinds: Record<string, string> = {
    nft_mint: "minted",
    nft_transfer: "transferred",
    nft_burn: "burned",
    sub_account_rented: "minted",
    sub_account_re_rented: "re_rented",
    sub_account_transferred: "transferred",
    sub_account_recovered: "transferred",
    sub_account_reclaimed: "reclaimed",
  };
  let previouslyOwned = false,
    events = 0;
  for (const line of discovery.sections.history?.lines ?? []) {
    const data = line.data;
    if (!data) continue;
    let kind = kinds[String(data.event)];
    if (!kind) continue;
    if (kind === "minted" && previouslyOwned) kind = "re_rented";
    previouslyOwned = true;
    const block_time = String(data.block_time);
    if (!Number.isFinite(Date.parse(block_time))) throw new Error("Ownership event timestamp is missing.");
    store.append({
      id: `indexed:${String(data.transaction_hash)}:${String(data.event)}:${name}`,
      token_id: name,
      kind,
      from_owner:
        typeof data.old_owner_id === "string" ? data.old_owner_id : typeof data.from === "string" ? data.from : null,
      to_owner:
        typeof data.new_owner_id === "string"
          ? data.new_owner_id
          : typeof data.owner_id === "string"
            ? data.owner_id
            : typeof data.to === "string"
              ? data.to
              : typeof data.owner === "string"
                ? data.owner
                : null,
      block_height: Number(data.block_height),
      block_time,
      tx_hash: String(data.transaction_hash),
      details: { ...data, network: rpc.network, coverage_source: discovery.coverage.source },
    });
    events++;
  }
  store.setCoverage(name, discovery.coverage.since, discovery.coverage.through, true);
  return { baseline_height: discovery.coverage.block_height, name, events, coverage: store.coverage(name) };
}
