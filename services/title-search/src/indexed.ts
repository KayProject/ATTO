import type { ReportSection } from "@atto/shared";
import { Rpc, nsDate } from "./rpc";
import { unavailable, type Sections } from "./direct";

type Json = Record<string, unknown>;
const object = (value: unknown): Json => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed indexer object");
  return value as Json;
};
const array = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("Malformed indexer list");
  return value;
};
const string = (value: unknown): string => {
  if (typeof value !== "string" || !value) throw new Error("Malformed indexer string");
  return value;
};
const message = (error: unknown) => (error instanceof Error ? error.message : "Discovery failed");
const MAX_TRANSACTIONS = 2_000;
const COVERAGE =
  "Discovery relies on FastNEAR account indexing and standard contract interfaces. Programs absent from that index and custom storage may remain undiscovered.";
async function fastnear(path: string, body?: Json): Promise<Json> {
  const response = await fetch(path.startsWith("https:") ? path : `https://tx.main.fastnear.com/v0/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(process.env.FASTNEAR_API_KEY ? { Authorization: `Bearer ${process.env.FASTNEAR_API_KEY}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`FastNEAR HTTP ${response.status}`);
  return object(await response.json());
}

/** The span of ownership history a report read in full. */
export interface HistoryCoverage {
  since: string;
  through: string;
  source: string;
  block_height: number;
}

export async function indexed(
  name: string,
  rpc: Rpc,
): Promise<{
  sections: Sections;
  sources: string[];
  nfts: { contract_id: string; token_id: string }[];
  coverage?: HistoryCoverage;
}> {
  const sections: Sections = {
    nfts: unavailable("NFTs and approvals", COVERAGE),
    dao_roles: unavailable("DAO roles", COVERAGE),
    sub_accounts: unavailable("Sub-accounts", COVERAGE),
    history: unavailable("Ownership history", COVERAGE),
  };
  const sources: string[] = [];
  const nfts: { contract_id: string; token_id: string }[] = [];
  if (rpc.network !== "mainnet") {
    for (const section of Object.values(sections))
      section.note =
        "No complete receipt-history source is configured on this network. Seller disclosure alone cannot prove that the name is clear.";
    return { sections, sources, nfts };
  }
  const issues: string[] = [];
  const calls = new Map<string, Set<string>>();
  const keyDates = new Map<string, bigint>();
  const collections = new Set<string>();
  const children = new Set<string>();
  const history: ReportSection["lines"] = [];
  let tokenContracts = 0;
  let pinnedThrough: string | undefined;
  let pinnedHeight: number | undefined;
  try {
    const snapshot = await fastnear(`https://api.fastnear.com/v1/account/${encodeURIComponent(name)}/full`);
    for (const entry of array(snapshot.nfts)) collections.add(string(object(entry).contract_id));
    tokenContracts = array(snapshot.tokens).length;
    sources.push(
      `FastNEAR v1 account snapshot for ${name} (collection discovery only; fetched ${new Date().toISOString()})`,
    );
  } catch (error) {
    issues.push(`Account snapshot: ${message(error)}.`);
  }

  try {
    const head = await rpc.call<{ header: { height: number; timestamp_nanosec: string } }>("block", {
      finality: "final",
    });
    const finalHeight = head.header.height;
    pinnedThrough = nsDate(head.header.timestamp_nanosec);
    pinnedHeight = finalHeight;
    if (!Number.isSafeInteger(finalHeight)) throw new Error("Finalized block height unavailable");
    const hashes: string[] = [];
    const seen = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | undefined;
    let expected: number | undefined;
    let minHeight = finalHeight;
    for (let page = 0; page < MAX_TRANSACTIONS / 200; page++) {
      const data = await fastnear("account", {
        account_id: name,
        limit: 200,
        desc: false,
        to_tx_block_height: finalHeight + 1,
        ...(cursor ? { resume_token: cursor } : {}),
      });
      if (page === 0) {
        if (typeof data.txs_count !== "number" || !Number.isSafeInteger(data.txs_count) || data.txs_count < 0)
          throw new Error("Transaction count unavailable");
        expected = data.txs_count;
      }
      const rows = array(data.account_txs);
      for (const value of rows) {
        const row = object(value);
        const hash = string(row.transaction_hash);
        if (
          row.account_id !== name ||
          typeof row.tx_block_height !== "number" ||
          row.tx_block_height > finalHeight ||
          seen.has(hash)
        )
          throw new Error("Invalid or duplicate account-history row");
        seen.add(hash);
        hashes.push(hash);
        minHeight = Math.min(minHeight, row.tx_block_height);
      }
      if (data.resume_token != null && data.resume_token !== "") {
        cursor = string(data.resume_token);
        if (cursors.has(cursor) || rows.length === 0) throw new Error("Account-history cursor did not advance");
        cursors.add(cursor);
      } else {
        cursor = undefined;
        break;
      }
    }
    if (cursor || hashes.length !== expected)
      issues.push(`Account history is truncated or its count changed (${hashes.length} of ${expected} transactions).`);
    sources.push(
      `FastNEAR v0 account history for ${name}: ${hashes.length} transactions, transaction blocks ${hashes.length ? minHeight : "none"} through finalized block ${finalHeight}. ${COVERAGE}`,
    );
    for (let offset = 0; offset < hashes.length; offset += 20) {
      const batch = hashes.slice(offset, offset + 20);
      try {
        const response = await fastnear("transactions", { tx_hashes: batch });
        const returned = new Set<string>();
        for (const value of array(response.transactions)) {
          const tx = object(value);
          const hash = string(object(tx.transaction).hash);
          if (!batch.includes(hash) || returned.has(hash)) throw new Error("Unexpected or duplicate transaction");
          returned.add(hash);
          const receipts = array(tx.receipts).map(object);
          const ids = new Set(receipts.map((item) => string(object(item.receipt).receipt_id)));
          if (ids.size !== receipts.length) throw new Error("Duplicate receipt");
          const outcomes = [object(tx.execution_outcome), ...receipts.map((item) => object(item.execution_outcome))];
          for (const execution of outcomes) {
            for (const id of array(object(execution.outcome).receipt_ids)) {
              if (!ids.has(string(id))) throw new Error("Transaction has missing receipt execution");
            }
          }
          for (const item of receipts) {
            const receipt = object(item.receipt);
            const execution = object(item.execution_outcome);
            const outcome = object(execution.outcome);
            const status = object(outcome.status);
            if (execution.id !== receipt.receipt_id || outcome.executor_id !== receipt.receiver_id)
              throw new Error("Receipt execution identity mismatch");
            if (typeof execution.block_height !== "number" || execution.block_height > finalHeight)
              throw new Error("Receipt is outside finalized history");
            if ("Failure" in status) continue;
            if (!("SuccessValue" in status) && !("SuccessReceiptId" in status))
              throw new Error("Receipt execution is pending");
            const receiver = string(receipt.receiver_id);
            const body = object(receipt.receipt);
            if (body.Action && receipt.predecessor_id === name) {
              for (const raw of array(object(body.Action).actions)) {
                const action = typeof raw === "string" ? { [raw]: {} } : object(raw);
                if ("CreateAccount" in action || "DeterministicStateInit" in action) children.add(receiver);
                if (action.FunctionCall) {
                  const method = string(object(action.FunctionCall).method_name);
                  if (receiver === rpc.accounts.intents && method === "add_public_key") {
                    try {
                      const args = object(
                        JSON.parse(Buffer.from(string(object(action.FunctionCall).args), "base64").toString()),
                      );
                      const key = string(args.public_key),
                        at = BigInt(string(execution.block_timestamp));
                      if (at > (keyDates.get(key) ?? 0n)) keyDates.set(key, at);
                    } catch {
                      issues.push("An Intents key-add receipt could not be decoded.");
                    }
                  }
                  if (!calls.has(receiver)) calls.set(receiver, new Set());
                  calls.get(receiver)!.add(method);
                  if (method.startsWith("nft_")) collections.add(receiver);
                }
              }
            }
            for (const raw of array(outcome.logs)) {
              const log = string(raw);
              if (!log.startsWith("EVENT_JSON:")) continue;
              let event: Json;
              try {
                event = object(JSON.parse(log.slice(11)));
              } catch {
                issues.push(`Malformed event log in ${hash}.`);
                continue;
              }
              const entries = Array.isArray(event.data) ? event.data : [event.data];
              for (const value of entries) {
                const data = object(value);
                if (event.standard === "nep171" && (data.new_owner_id === name || data.owner_id === name))
                  collections.add(receiver);
                const trusted =
                  receiver === rpc.accounts.registry &&
                  ((event.standard === "nep171" && Array.isArray(data.token_ids) && data.token_ids.includes(name)) ||
                    (event.standard === "hos_tla_registry" && data.full_name === name));
                if (
                  trusted &&
                  [
                    "nft_transfer",
                    "nft_mint",
                    "nft_burn",
                    "sub_account_transferred",
                    "sub_account_created",
                    "sub_account_rented",
                    "sub_account_expired",
                  ].includes(String(event.event))
                ) {
                  history.push({
                    label: `${String(event.event)} at ${nsDate(String(execution.block_timestamp))}`,
                    detail: `Registry event: ${JSON.stringify(data)}. Transaction ${hash}.`,
                    rating: "Clean",
                    data: {
                      transaction_hash: hash,
                      block_height: execution.block_height,
                      source: receiver,
                      event: event.event,
                      ...data,
                    },
                  });
                }
              }
            }
          }
        }
        if (returned.size !== batch.length) throw new Error("Requested transaction receipts are missing");
      } catch (error) {
        issues.push(`Receipt batch ${offset / 20 + 1}: ${message(error)}.`);
      }
    }
  } catch (error) {
    issues.push(`Account history: ${message(error)}.`);
  }

  const nftIssues: string[] = [];
  const nftLines: ReportSection["lines"] = [];
  const daoLines: ReportSection["lines"] = [];
  const daoIssues: string[] = [];
  await Promise.all(
    [...collections].sort().map(async (collection) => {
      try {
        const seen = new Set<string>();
        for (let offset = 0; offset < 10_000; offset += 100) {
          const page = array(
            await rpc.view(collection, "nft_tokens_for_owner", {
              account_id: name,
              from_index: String(offset),
              limit: 100,
            }),
          );
          if (page.length > 100) throw new Error("NFT page exceeds requested size");
          for (const value of page) {
            const token = object(value);
            const id = string(token.token_id);
            if (seen.has(id) || token.owner_id !== name) throw new Error("Invalid owner or repeated token in NFT page");
            seen.add(id);
            const approvals = Object.keys(object(token.approved_account_ids));
            nfts.push({ contract_id: collection, token_id: id });
            nftLines.push({
              label: `${collection} / ${id}`,
              detail: approvals.length
                ? `Approved: ${approvals.join(", ")}`
                : "No approvals returned by this contract.",
              rating: approvals.length ? "WillBeCleared" : "Clean",
            });
          }
          if (page.length < 100) return;
        }
        throw new Error("NFT enumeration reached the 10,000-token safety limit");
      } catch (error) {
        nftIssues.push(`${collection}: ${message(error)}.`);
      }
    }),
  );
  await Promise.all(
    [...calls]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([contract, methods]) => {
        if (
          [
            rpc.accounts.registry,
            rpc.accounts.intents,
            rpc.accounts.hosExtension,
            rpc.accounts.escrow,
            rpc.accounts.keeper,
          ].includes(contract)
        )
          return;
        if (contract === name && [...methods].every((method) => method.startsWith("hos_") || method.startsWith("w_")))
          return;
        try {
          const policy = object(await rpc.view(contract, "get_policy"));
          for (const value of array(policy.roles)) {
            const role = object(value);
            const kind = role.kind;
            const applies =
              kind === "Everyone" ||
              (typeof kind === "object" &&
                kind !== null &&
                Array.isArray((kind as Json).Group) &&
                ((kind as Json).Group as unknown[]).includes(name));
            if (applies)
              daoLines.push({
                label: `${contract} / ${string(role.name)}`,
                detail: `Current DAO policy ${kind === "Everyone" ? "applies to every account" : "includes this name"}. Permissions: ${JSON.stringify(array(role.permissions))}.`,
                rating: "NeedsSeller",
                ask_seller: "Confirm whether this DAO role should remain attached to the name.",
              });
          }
        } catch (error) {
          daoIssues.push(`${contract}: ${message(error)}.`);
          daoLines.push({
            label: contract,
            detail: `DAO classification is unresolved. Successful calls: ${[...methods].sort().join(", ")}. A failed policy view does not prove there is no DAO role.`,
            rating: "NeedsSeller",
            ask_seller: "Disclose custom DAO memberships or provide the supported membership view for this contract.",
          });
        }
      }),
  );
  const common = `${COVERAGE} ${issues.join(" ")}`.trim();
  sections.nfts = {
    title: "NFTs and approvals",
    status: issues.length || nftIssues.length ? "unavailable" : nftLines.length ? "filled" : "none_found",
    lines: nftLines.sort((a, b) => a.label.localeCompare(b.label)),
    note: `Checked ${collections.size} discovered collections. ${tokenContracts} fungible-token contracts were discovered; their balances are outside this manifest. ${common} ${nftIssues.join(" ")} A view-method failure does not prove that a contract holds no NFTs.`,
  };
  sections.dao_roles = {
    title: "DAO roles",
    status: issues.length || daoIssues.length ? "unavailable" : daoLines.length ? "filled" : "none_found",
    lines: daoLines.sort((a, b) => a.label.localeCompare(b.label)),
    note: `Checked ${calls.size} successfully called contracts for DAO policy. ${common} ${daoIssues.join(" ")} Custom role rules may require seller disclosure.`,
  };
  sections.sub_accounts = {
    title: "Sub-accounts",
    status: issues.length ? "unavailable" : children.size ? "filled" : "none_found",
    lines: [...children].sort().map((child) => ({
      label: child,
      detail:
        "Successful account-creation receipt sent by this name. Its access keys do not rotate when this name is sold.",
      rating: "NeedsSeller",
      ask_seller: "Disclose who controls this account and resolve any continuing dependency.",
    })),
    note: common,
  };
  history.sort(
    (a, b) => Number(a.data?.block_height ?? 0) - Number(b.data?.block_height ?? 0) || a.label.localeCompare(b.label),
  );
  sections.history = {
    title: "Ownership history",
    status: issues.length ? "unavailable" : history.length ? "filled" : "none_found",
    lines: history,
    note: `Only successful events emitted by the configured registry are treated as registry history. Transfer requests and third-party logs are not proof of an owner change. ${common}`,
  };
  try {
    const held = await rpc.view<string[]>(rpc.accounts.intents, "public_keys_of", { account_id: name });
    if (!Array.isArray(held) || held.some((key) => typeof key !== "string"))
      throw new Error("Malformed Intents key response");
    sections.intents_keys = {
      title: "Intents signing keys",
      status: held.length ? "filled" : "none_found",
      lines: held.sort().map((key) => ({
        label: key,
        detail: keyDates.has(key)
          ? `Successful account-authorized add_public_key observed at ${nsDate(keyDates.get(key)!.toString())}.`
          : "The signing key is currently active. Its addition date is unknown; signed-intent additions may not use a direct add_public_key call.",
        rating: "WillBeCleared",
        data: keyDates.has(key) ? { observed_added_at: nsDate(keyDates.get(key)!.toString()) } : undefined,
      })),
      note: "Addition dates are receipt observations, not a claim about who currently controls a key.",
    };
  } catch {}
  nfts.sort((a, b) => a.contract_id.localeCompare(b.contract_id) || a.token_id.localeCompare(b.token_id));
  // The account history covers every transaction since the account was created, up to the pinned block.
  const coverage =
    sections.history.status !== "unavailable" && pinnedThrough && pinnedHeight !== undefined
      ? { since: new Date(0).toISOString(), through: pinnedThrough, source: "fastnear", block_height: pinnedHeight }
      : undefined;
  return { sections, sources, nfts, coverage };
}
