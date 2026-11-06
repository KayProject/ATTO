// AttoClient methods served by the real contracts on a local NEAR sandbox.
// Only runs on the server, against a loopback RPC, with throwaway sandbox keys.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Account, actions, type KeyPairString } from "near-api-js";
import {
  CLEARING_TIMEOUT_NS,
  RECLAIM_AFTER_NS,
  TERMINAL_STATES,
  type Listing,
  type NetworkAccounts,
  type Report,
} from "@atto/shared";
import { Rpc } from "@atto/title-search";
import { fixtureReport } from "@atto/title-search/sandbox";
import { HistoryStore, ingestOutcomes } from "@atto/follower";
import { driveSale } from "@atto/bot";
import { Refusal } from "../mock/world";
import type {
  ChangedAnswer,
  HandOverResult,
  HistoryEvent,
  HistoryKind,
  OwnedName,
  ReportSummary,
  SaleView,
} from "../types";

interface Runtime {
  network: string;
  rpcUrl: string;
  registry: string;
  intents: string;
  hosExtension: string;
  escrow: string;
  keeper: string | null;
  seller: string;
  buyer: string;
  bot: string;
  name: string;
}
type Credentials = Record<"seller" | "buyer" | "bot", { accountId: string; secretKey: KeyPairString }>;

const GAS = 300_000_000_000_000n;
const LIST_DEPOSIT = 50_000_000_000_000_000_000_000n;
const CLEAR_DEPOSIT = 10_000_000_000_000_000_000_000n;
const HISTORY_KINDS = new Set<HistoryKind>([
  "minted",
  "transferred",
  "sold_clean",
  "renewed",
  "renewed_by_keeper",
  "reclaimed",
  "re_rented",
]);

const refuse = (message: string): never => {
  throw new Refusal(message);
};

function loopback(url: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
}

/** Reads the runtime written by the sandbox deploy test, fresh on every call. */
function load() {
  const path = resolve(/* turbopackIgnore: true */ process.env.ATTO_SANDBOX_RUNTIME ?? "../workbench/sandbox/runtime.json");
  const runtime = JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8")) as Runtime;
  if (runtime.network !== "sandbox" || !loopback(runtime.rpcUrl))
    throw new Error("The sandbox backend needs a loopback sandbox RPC.");
  const credentials = JSON.parse(
    readFileSync(/* turbopackIgnore: true */ resolve(dirname(path), "credentials.json"), "utf8"),
  ) as Credentials;
  const accounts: NetworkAccounts = {
    rpc: runtime.rpcUrl,
    registry: runtime.registry,
    intents: runtime.intents,
    hosExtension: runtime.hosExtension,
    escrow: runtime.escrow,
    keeper: runtime.keeper,
  };
  return { path, runtime, credentials, rpc: new Rpc(accounts, "sandbox") };
}

const shared = globalThis as unknown as { __attoSandboxStore?: HistoryStore };
function store() {
  shared.__attoSandboxStore ??= new HistoryStore(process.env.ATTO_DB_PATH ?? "../workbench/atto.sqlite");
  return shared.__attoSandboxStore;
}

type Ctx = ReturnType<typeof load>;

/** The contract's own refusal text, without the RPC wrapping around it. */
function contractError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.match(/Smart contract panicked: ([^"\n]+)/)?.[1] ?? text.slice(0, 300);
}

/** Signs one function call as a sandbox account and files its ATTO and registry events into history. */
async function send(ctx: Ctx, signer: string, receiver: string, method: string, args: object, deposit = 0n) {
  const key = Object.values(ctx.credentials).find((c) => c.accountId === signer);
  if (!key) refuse(`${signer} has no sandbox key, so it can only read.`);
  const account = new Account(signer, ctx.runtime.rpcUrl, key!.secretKey);
  const outcome = (await account
    .signAndSendTransaction({
      receiverId: receiver,
      actions: [actions.functionCall(method, args, GAS, deposit)],
      waitUntil: "FINAL",
      throwOnFailure: true,
    })
    .catch((error: unknown) => refuse(contractError(error)))) as unknown as {
    receipts_outcome: {
      id: string;
      block_hash: string;
      outcome: { executor_id: string; logs: string[]; status: unknown };
    }[];
  };
  const allowed = new Set([ctx.runtime.registry, ctx.runtime.escrow, ctx.runtime.keeper].filter(Boolean) as string[]);
  for (const receipt of outcome.receipts_outcome ?? []) {
    if (!allowed.has(receipt.outcome.executor_id) || receipt.outcome.logs.length === 0) continue;
    const block = await ctx.rpc.call<{ header: { height: number; timestamp_nanosec: string } }>("block", {
      block_id: receipt.block_hash,
    });
    ingestOutcomes(store(), [{ id: receipt.id, ...receipt.outcome }], block.header, allowed, "sandbox");
  }
}

async function report(ctx: Ctx, final = false) {
  const value = await fixtureReport(ctx.runtime, ctx.rpc, ctx.path, final);
  store().saveReport(value);
  return value;
}

const listing = (ctx: Ctx, id: string) =>
  ctx.rpc.view<Listing | null>(ctx.runtime.escrow, "get_listing", { listing_id: id });
const openListing = async (ctx: Ctx) => {
  const l = await ctx.rpc.view<Listing | null>(ctx.runtime.escrow, "listing_for_token", { token_id: ctx.runtime.name });
  return l && !TERMINAL_STATES.includes(l.state) ? l : null;
};
const owner = async (ctx: Ctx) =>
  (await ctx.rpc.view<{ owner_id: string } | null>(ctx.runtime.registry, "nft_token", { token_id: ctx.runtime.name }))
    ?.owner_id ?? null;
const chainNow = async (ctx: Ctx) =>
  (await ctx.rpc.call<{ header: { timestamp_nanosec: string } }>("block", { finality: "final" })).header
    .timestamp_nanosec;

/**
 * The website's personas map onto the two sandbox accounts by role: "seller" and "owner" are
 * whoever can sell the name right now, "buyer" is the other one, "stranger" has no key.
 */
export async function sandboxAccount(persona: string) {
  const ctx = load();
  const pair = [ctx.runtime.seller, ctx.runtime.buyer];
  const open = await openListing(ctx);
  const current = open?.seller ?? (await owner(ctx));
  const seller = current && pair.includes(current) ? current : ctx.runtime.seller;
  const buyer = pair.find((a) => a !== seller)!;
  if (persona === "seller" || persona === "owner") return seller;
  if (persona === "buyer") return buyer;
  return "guest.test.near";
}

function summary(r: Report): ReportSummary {
  const counts = { Clean: 0, WillBeCleared: 0, NeedsSeller: 0 };
  for (const section of Object.values(r.sections)) for (const line of section.lines) counts[line.rating]++;
  return { fingerprint: r.fingerprint, built_at: r.built_at, counts };
}

const reportsFor = (ctx: Ctx) => store().reports(ctx.runtime.name);

/** Hands the held name to the bot, which posts the final report, clears, verifies and completes. */
function runBot(ctx: Ctx, id: string) {
  const bot = ctx.runtime.bot;
  void driveSale(
    {
      getListing: (lid) => listing(ctx, lid),
      report: () => report(ctx, true),
      postManifest: (lid, r) =>
        send(ctx, bot, ctx.runtime.escrow, "post_manifest", { listing_id: lid, manifest: r.manifest }),
      clear: (lid, count) => send(ctx, bot, ctx.runtime.escrow, "clear", { listing_id: lid, count }, CLEAR_DEPOSIT),
      verify: (lid) => send(ctx, bot, ctx.runtime.escrow, "verify", { listing_id: lid }),
      complete: (lid) => send(ctx, bot, ctx.runtime.escrow, "complete", { listing_id: lid }),
      reverse: (lid) => send(ctx, bot, ctx.runtime.escrow, "reverse", { listing_id: lid }),
    },
    id,
  ).catch((error) => console.error(`Sandbox bot stopped on sale ${id}:`, error));
}

function fixtureName(ctx: Ctx, name: string) {
  if (name !== ctx.runtime.name) refuse(`The local sandbox only holds ${ctx.runtime.name}.`);
}

export const sandbox = {
  async getReport(name: string): Promise<Report | null> {
    const ctx = load();
    return name === ctx.runtime.name ? report(ctx) : null;
  },

  async getHistory(name: string): Promise<HistoryEvent[]> {
    const ctx = load();
    if (name !== ctx.runtime.name) return [];
    const reports = new Map(reportsFor(ctx).map((r) => [r.fingerprint, r]));
    const cleared = new Map<string, { keys: string[]; nfts: { contract_id: string; token_id: string }[] }>();
    const rows = store().history(name, 100);
    for (const row of rows)
      if (row.kind === "cleared") {
        const d = row.details as { listing_id?: string; keys_removed?: string[]; nfts_revoked?: never[] };
        const entry = cleared.get(d.listing_id ?? "") ?? { keys: [], nfts: [] };
        entry.keys.push(...(d.keys_removed ?? []));
        entry.nfts.push(...(d.nfts_revoked ?? []));
        cleared.set(d.listing_id ?? "", entry);
      }
    return rows
      .filter((row) => HISTORY_KINDS.has(row.kind as HistoryKind))
      .map((row, index) => {
        const d = row.details as { listing_id?: string; price?: string };
        let sale: HistoryEvent["sale"];
        if (row.kind === "sold_clean" && d.listing_id) {
          const l = cleared.get(d.listing_id);
          const accepted = [...reports.values()].find((r) => !r.final);
          const final = [...reports.values()].find((r) => r.final);
          sale = {
            listing_id: d.listing_id,
            price: d.price ?? "0",
            accepted_report: accepted ? summary(accepted) : null,
            final_report: final ? summary(final) : null,
            keys_removed: l?.keys ?? [],
            nfts_revoked: l?.nfts ?? [],
          };
        }
        return {
          id: rows.length - index,
          token_id: row.token_id,
          kind: row.kind as HistoryKind,
          from_owner: row.from_owner,
          to_owner: row.to_owner,
          block_time: row.block_time,
          tx_hash: row.tx_hash ?? "",
          sale,
        };
      });
  },

  async changedOwner(name: string, days: number): Promise<ChangedAnswer | null> {
    const ctx = load();
    if (name !== ctx.runtime.name) return null;
    const answer = store().changed(name, Math.min(days, 365)) as {
      changed: boolean | null;
      at?: string;
      kind?: string;
      previous_owner?: string | null;
    };
    if (answer.changed === null) return null;
    return answer.changed
      ? {
          changed: true,
          at: answer.at,
          kind: answer.kind as HistoryKind,
          previous_owner: answer.previous_owner ?? null,
        }
      : { changed: false };
  },

  async sampleNames() {
    return [load().runtime.name];
  },

  async ownedBy(caller: string): Promise<OwnedName[]> {
    const ctx = load();
    const token = await ctx.rpc.view<{ owner_id: string; metadata?: { extra?: string } } | null>(
      ctx.runtime.registry,
      "nft_token",
      { token_id: ctx.runtime.name },
    );
    if (token?.owner_id !== caller) return [];
    const expires = JSON.parse(token.metadata?.extra ?? "{}").expires_at as string | undefined;
    const r = await report(ctx);
    return [
      {
        name: ctx.runtime.name,
        lease_end: expires ? new Date(Number(BigInt(expires) / 1_000_000n)).toISOString() : "",
        listing_id: (await openListing(ctx))?.id ?? null,
        clean_sale: r.clean_sale,
      },
    ];
  },

  async openSales() {
    const l = await openListing(load());
    return l && l.state === "Listed" ? [l] : [];
  },

  async mySales(caller: string) {
    const ctx = load();
    const all = await ctx.rpc.view<Listing[]>(ctx.runtime.escrow, "listings_for", { account_id: caller });
    return all.reverse();
  },

  async getSale(caller: string, id: string): Promise<SaleView | null> {
    const ctx = load();
    const l = await listing(ctx, id);
    if (!l) return null;
    const reports = reportsFor(ctx);
    const accepted = reports.find((r) => r.fingerprint === l.accepted_fingerprint && !r.final);
    const final = l.name_at ? (reports.find((r) => r.final) ?? null) : null;
    const now = await chainNow(ctx);
    const reclaim_at = l.paid_at ? (BigInt(l.paid_at) + RECLAIM_AFTER_NS).toString() : null;
    const reverse_at = l.name_at ? (BigInt(l.name_at) + CLEARING_TIMEOUT_NS).toString() : null;
    const held = l.state === "NameHeld" || l.state === "Clearing" || l.state === "Verified";
    const timedOut = l.state !== "Verified" && reverse_at !== null && BigInt(now) >= BigInt(reverse_at);
    const awaiting = l.state === "NameHeld" && !!final && final.fingerprint !== l.accepted_fingerprint;
    return {
      listing: l,
      report: accepted ?? reports.find((r) => !r.final) ?? (await report(ctx)),
      final_report: final,
      awaiting_buyer: awaiting,
      reclaim_at,
      reverse_at,
      now,
      can: {
        delist: l.state === "Listed" && caller === l.seller,
        pay: l.state === "Listed" && caller !== l.seller,
        cancel: l.state === "Paid" && caller === l.buyer,
        reclaim: l.state === "Paid" && reclaim_at !== null && BigInt(now) >= BigInt(reclaim_at),
        hand_over: l.state === "Paid" && caller === l.seller,
        accept_changed: awaiting && caller === l.buyer,
        reverse: held && (l.failure !== null || timedOut),
      },
    };
  },

  async list(caller: string, token_id: string, price: string) {
    const ctx = load();
    fixtureName(ctx, token_id);
    if (BigInt(price) <= 0n) refuse("Set a price above zero.");
    const r = await report(ctx);
    if (!r.clean_sale.supported) refuse(r.clean_sale.reason ?? "This name can't be sold through ATTO.");
    await send(ctx, caller, ctx.runtime.escrow, "list", { token_id, price }, LIST_DEPOSIT);
    return (await openListing(ctx))?.id ?? refuse("The escrow didn't record the listing.");
  },

  async delist(caller: string, id: string) {
    const ctx = load();
    await send(ctx, caller, ctx.runtime.escrow, "delist", { listing_id: id });
  },

  async pay(caller: string, id: string, fingerprint: string) {
    const ctx = load();
    const l = (await listing(ctx, id)) ?? refuse("No such sale.");
    const r = await report(ctx);
    if (r.fingerprint !== fingerprint)
      refuse("The report changed since you read it. Read the new report before paying.");
    await send(ctx, caller, ctx.runtime.escrow, "pay", { listing_id: id, fingerprint }, BigInt(l!.price));
  },

  async cancel(caller: string, id: string) {
    const ctx = load();
    await send(ctx, caller, ctx.runtime.escrow, "cancel", { listing_id: id });
  },

  async reclaimPayment(id: string) {
    const ctx = load();
    await send(ctx, ctx.runtime.bot, ctx.runtime.escrow, "reclaim_payment", { listing_id: id });
  },

  async handOver(caller: string, id: string): Promise<HandOverResult> {
    const ctx = load();
    const msg = id;
    await send(
      ctx,
      caller,
      ctx.runtime.registry,
      "nft_transfer_call",
      { receiver_id: ctx.runtime.escrow, token_id: ctx.runtime.name, approval_id: null, memo: null, msg },
      1n,
    );
    const l = await listing(ctx, id);
    if (l?.state !== "NameHeld")
      return { accepted: false, reason: "the buyer hasn't paid, so the name went back to you" };
    runBot(ctx, id);
    return { accepted: true };
  },

  async acceptChangedReport(caller: string, id: string) {
    const ctx = load();
    const final = await report(ctx, true);
    await send(ctx, caller, ctx.runtime.escrow, "post_manifest", { listing_id: id, manifest: final.manifest });
    runBot(ctx, id);
  },

  async reverse(id: string) {
    const ctx = load();
    await send(ctx, ctx.runtime.bot, ctx.runtime.escrow, "reverse", { listing_id: id });
  },
};
