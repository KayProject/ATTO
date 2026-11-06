import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { Account, actions, type KeyPairString } from "near-api-js";
import type { Listing } from "@atto/shared";
import { Rpc } from "../../title-search/src/rpc";
import { fixtureReport } from "../../title-search/src/sandbox";
import { HistoryStore } from "../../follower/src/store";
import { driveSale } from "./sale";
import { keeperTick } from "./keeper";
const path = resolve(process.env.ATTO_SANDBOX_RUNTIME ?? "../../workbench/sandbox/runtime.json");
const runtime = JSON.parse(readFileSync(path, "utf8")) as {
  network: string;
  rpcUrl: string;
  registry: string;
  intents: string;
  hosExtension: string;
  escrow: string;
  keeper: string | null;
  name: string;
  bot: string;
};
if (runtime.network !== "sandbox" || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(runtime.rpcUrl).hostname))
  throw new Error("The bot only signs against a local sandbox.");
const credentials = JSON.parse(readFileSync(resolve(dirname(path), "credentials.json"), "utf8")) as {
  bot: { accountId: string; secretKey: KeyPairString };
};
if (credentials.bot.accountId !== runtime.bot) throw new Error("Bot credentials do not match the local runtime.");
const rpc = new Rpc(
  {
    rpc: runtime.rpcUrl,
    registry: runtime.registry,
    intents: runtime.intents,
    hosExtension: runtime.hosExtension,
    escrow: runtime.escrow,
    keeper: runtime.keeper,
  },
  "sandbox",
);
const account = new Account(runtime.bot, runtime.rpcUrl, credentials.bot.secretKey);
const db = new HistoryStore(process.env.ATTO_DB_PATH ?? "../../workbench/atto.sqlite");
db.db.exec("CREATE TABLE IF NOT EXISTS bot_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
const get = (key: string) =>
  db.db.prepare("SELECT value FROM bot_state WHERE key=?").get(key)?.value as string | undefined;
const set = (key: string, value: string) =>
  db.db.prepare("INSERT OR REPLACE INTO bot_state VALUES(?,?)").run(key, value);
const names = (process.env.ATTO_BOT_NAMES ?? runtime.name)
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean);
const last = {
  pull: Number(get("last:pull") ?? 0),
  renew: Number(get("last:renew") ?? 0),
  refund: Number(get("last:refund") ?? 0),
};
const send = async (receiver: string, method: string, args: object, deposit = 0n) => {
  await account.signAndSendTransaction({
    receiverId: receiver,
    actions: [actions.functionCall(method, args, 300000000000000n, deposit)],
    waitUntil: "FINAL",
    throwOnFailure: true,
  });
};
let running = true;
process.on("SIGINT", () => {
  running = false;
});
while (running) {
  for (const name of names) {
    try {
      const listing = await rpc.view<Listing | null>(runtime.escrow, "listing_for_token", { token_id: name });
      if (listing && ["NameHeld", "Clearing", "Verified"].includes(listing.state)) {
        const result = await driveSale(
          {
            getListing: (id) => rpc.view(runtime.escrow, "get_listing", { listing_id: id }),
            report: async () => {
              if (name !== runtime.name) throw new Error("No fixture report exists for this name.");
              const r = await fixtureReport(runtime, rpc, path, true);
              db.saveReport(r);
              return r;
            },
            postManifest: async (id, r) =>
              send(runtime.escrow, "post_manifest", { listing_id: id, manifest: r.manifest }),
            clear: async (id, count) =>
              send(runtime.escrow, "clear", { listing_id: id, count }, 10000000000000000000000n),
            verify: (id) => send(runtime.escrow, "verify", { listing_id: id }),
            complete: (id) => send(runtime.escrow, "complete", { listing_id: id }),
            reverse: (id) => send(runtime.escrow, "reverse", { listing_id: id }),
          },
          listing.id,
        );
        console.log(JSON.stringify({ name, ...result }));
      }
    } catch (e) {
      console.error(name, e instanceof Error ? e.message : e);
    }
  }
  if (runtime.keeper) {
    const keeper = runtime.keeper;
    const balance = async (name: string) => BigInt((await rpc.query<{ amount: string }>(name, "view_account")).amount);
    const result = await keeperTick(
      {
        enabledNames: async () => names,
        pullPlan: async (name) => {
          const reserve = await rpc.view<{
            enabled: boolean;
            share_bps: number;
            collector: string;
            balance: string;
          } | null>(keeper, "get_reserve", { name });
          if (!reserve?.enabled) {
            set(`${name}:balance`, (await balance(name)).toString());
            return { enabled: false, amount: 0n, remainingCap: 0n };
          }
          const current = await balance(name),
            previous = get(`${name}:balance`);
          if (!previous) {
            set(`${name}:balance`, current.toString());
            return { enabled: true, amount: 0n, remainingCap: 0n };
          }
          const grant = await rpc.view<{ budget_yocto: string; spent_yocto: string; receivers: string[] } | null>(
            name,
            "hos_spend_grant",
            { extension: reserve.collector },
          );
          if (!grant || grant.receivers.length !== 1 || grant.receivers[0] !== reserve.collector)
            throw new Error("Collector grant is missing or has different receivers.");
          if (current < BigInt(previous)) set(`${name}:balance`, current.toString());
          const growth = current > BigInt(previous) ? current - BigInt(previous) : 0n;
          set(`${name}:sample`, current.toString());
          return {
            enabled: true,
            amount: (growth * BigInt(reserve.share_bps)) / 10000n,
            remainingCap:
              BigInt(grant.budget_yocto) > BigInt(grant.spent_yocto)
                ? BigInt(grant.budget_yocto) - BigInt(grant.spent_yocto)
                : 0n,
          };
        },
        pull: async (name, amount) => {
          await send(keeper, "pull", { name, amount });
          await send(keeper, "sync", { name });
          set(`${name}:balance`, (await balance(name)).toString());
        },
        dueSoon: async () => {
          const due: string[] = [];
          for (let offset = 0; offset < 10000; offset += 100) {
            const page = await rpc.view<string[]>(keeper, "due_soon", {
              from_index: offset,
              limit: 100,
              within_ns: (30n * 86400n * 1000000000n).toString(),
            });
            due.push(...page);
            if (page.length < 100) return due;
          }
          throw new Error("Keeper due list exceeds the 10,000-name safety limit.");
        },
        renew: async (name) => {
          const before = await rpc.view<{ expires_at: string }>(keeper, "get_reserve", { name });
          await send(keeper, "renew", { name });
          const after = await rpc.view<{ expires_at: string }>(keeper, "get_reserve", { name });
          if (BigInt(after.expires_at) <= BigInt(before.expires_at))
            throw new Error("Renewal did not extend the lease. Check the reserve and the registry quote.");
          set(`${name}:warning`, "");
        },
        collectRefunds: async () => {
          let pending = false;
          for (const name of names) {
            const reserve = await rpc.view<{ pending_amount: string; owed_by_registry: string } | null>(
              keeper,
              "get_reserve",
              { name },
            );
            if (reserve && (BigInt(reserve.pending_amount) > 0n || BigInt(reserve.owed_by_registry) > 0n))
              pending = true;
          }
          if (pending) await send(keeper, "collect_refunds", {});
        },
      },
      Date.now(),
      last,
    );
    console.log(JSON.stringify({ kind: "keeper_tick", names, errors: result.errors }));
    for (const entry of result.errors) {
      set(`${entry.name}:warning`, entry.error);
      console.error(JSON.stringify(entry));
    }
    for (const [key, value] of Object.entries(last)) set(`last:${key}`, String(value));
  }
  if (process.argv.includes("--once")) break;
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
db.close();
