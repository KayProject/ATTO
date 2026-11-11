// AttoClient on NEAR mainnet: reads come from the server, every write is approved in the visitor's wallet.
import { driveSale, type SaleDriver } from "@atto/bot";
import type { Listing, Report } from "@atto/shared";
import type { AttoClient, KeeperState, OwnerView, SaleView } from "../types";
import { walletSend, type WalletCall } from "./wallet";

type Call = <T>(method: string, args?: object) => Promise<T>;

const LISTING_DEPOSIT = "50000000000000000000000";
const CLEAR_DEPOSIT = "10000000000000000000000";
const NAME_CALL_GAS = "80000000000000";

type Sign = (receiverId: string, calls: WalletCall[]) => Promise<unknown>;

/** `sign` defaults to the visitor's wallet; proof scripts swap in a testnet key. */
export function mainnetClient(call: Call, sign: Sign = walletSend): AttoClient {
  let config: Promise<{ escrow: string; registry: string }> | null = null;
  const contracts = () => (config ??= call("config"));
  const escrowCall = async (method: string, args: object, deposit?: string): Promise<void> => {
    await sign((await contracts()).escrow, [{ methodName: method, args, deposit }]);
  };
  const sale = async (id: string) => {
    const view = await call<SaleView | null>("getSale", { id });
    if (!view) throw new Error("No such sale.");
    return view;
  };
  /**
   * Runs one escrow call on a sale, then waits until reads show the sale changed.
   * Reads trail a write by a block or two, so the next step would otherwise act on the old state.
   */
  async function act(id: string, method: string, args: object, deposit?: string) {
    const before = JSON.stringify((await sale(id)).listing);
    await escrowCall(method, args, deposit);
    await moved(id, before);
  }
  async function moved(id: string, before: string) {
    for (let i = 0; i < 8; i++) {
      const { listing } = await sale(id);
      if (JSON.stringify(listing) !== before) return listing;
      await new Promise((r) => setTimeout(r, 1200));
    }
    return (await sale(id)).listing;
  }

  const keeper = (name: string) => call<KeeperState>("keeperState", { name });
  const ownerView = (name: string) => call<OwnerView>("getOwnerView", { name });
  // The report is rebuilt on every read, so it is left out when checking whether a write has landed.
  const ownerFacts = async (name: string) => JSON.stringify({ ...(await ownerView(name)), report: null });
  /** Runs one Keeper write, then waits until the owner page's reads show it. */
  async function ownerAct(name: string, write: () => Promise<unknown>) {
    const before = await ownerFacts(name);
    await write();
    for (let i = 0; i < 8 && (await ownerFacts(name)) === before; i++) await new Promise((r) => setTimeout(r, 1200));
  }
  /** One call on the name's own account, which only its owner can make. */
  const nameCall = (methodName: string, args: object): WalletCall => ({
    methodName,
    args,
    deposit: "1",
    gas: NAME_CALL_GAS,
  });
  /** Has the name itself call a contract, for the methods that only answer to the name. */
  const asName = (receiver_id: string, function_name: string, args: object, gas: string) =>
    nameCall("w_execute_extension", {
      request: {
        external: [
          { receiver_id, actions: [{ action: "function_call", payload: { function_name, args: btoa(JSON.stringify(args)), gas } }] },
        ],
      },
    });

  /** Posts the final report, clears, verifies and completes, one wallet approval per step. */
  async function finish(id: string) {
    const driver: SaleDriver = {
      getListing: async (lid) => (await call<SaleView | null>("getSale", { id: lid }))?.listing ?? null,
      report: (name) => call<Report>("finalReport", { name }),
      postManifest: (lid, report) => act(lid, "post_manifest", { listing_id: lid, manifest: report.manifest }),
      clear: (lid, count) => act(lid, "clear", { listing_id: lid, count }, CLEAR_DEPOSIT),
      verify: (lid) => act(lid, "verify", { listing_id: lid }),
      complete: (lid) => act(lid, "complete", { listing_id: lid }),
      reverse: (lid) => act(lid, "reverse", { listing_id: lid }),
    };
    const result = await driveSale(driver, id);
    if (result.state === "blocked") throw new Error(result.reason ?? "This name can't complete a Clean Sale.");
  }

  return {
    getReport: (name) => call("getReport", { name }),
    getHistory: (name) => call("getHistory", { name }),
    changedOwner: (name, days) => call("changedOwner", { name, days }),
    sampleNames: () => call("sampleNames"),
    ownedBy: () => call("ownedBy"),
    openSales: () => call("openSales"),
    mySales: () => call("mySales"),
    getSale: (id) => call("getSale", { id }),

    async list(token_id, price) {
      if (BigInt(price) <= 0n) throw new Error("Set a price above zero.");
      await escrowCall("list", { token_id, price }, LISTING_DEPOSIT);
      let listing = await call<Listing | null>("listingFor", { token_id });
      // The first read after the write can land on a node that hasn't seen it yet.
      for (let i = 0; i < 5 && (!listing || listing.state !== "Listed"); i++) {
        await new Promise((r) => setTimeout(r, 1200));
        listing = await call<Listing | null>("listingFor", { token_id });
      }
      if (!listing || listing.state !== "Listed") throw new Error("The escrow didn't record the listing.");
      return listing.id;
    },
    delist: (id) => act(id, "delist", { listing_id: id }),
    async pay(id, fingerprint) {
      const view = await sale(id);
      if (view.report.fingerprint !== fingerprint)
        throw new Error("The report changed since you read it. Read the new report before paying.");
      await act(id, "pay", { listing_id: id, fingerprint }, view.listing.price);
    },
    cancel: (id) => act(id, "cancel", { listing_id: id }),
    reclaimPayment: (id) => act(id, "reclaim_payment", { listing_id: id }),
    async handOver(id) {
      const { listing } = await sale(id);
      const { escrow, registry } = await contracts();
      await sign(registry, [
        {
          methodName: "nft_transfer_call",
          args: { receiver_id: escrow, token_id: listing.token_id, approval_id: null, memo: null, msg: id },
          deposit: "1",
        },
      ]);
      // A refused hand-over leaves the sale untouched, so no change within the wait means it bounced.
      if ((await moved(id, JSON.stringify(listing))).state !== "NameHeld")
        return { accepted: false, reason: "the buyer hasn't paid, so the name went back to you" };
      await finish(id);
      return { accepted: true };
    },
    async acceptChangedReport(id) {
      const { listing } = await sale(id);
      const report = await call<Report>("finalReport", { name: listing.token_id });
      await act(id, "post_manifest", { listing_id: id, manifest: report.manifest });
      await finish(id);
    },
    reverse: (id) => act(id, "reverse", { listing_id: id }),
    finishSale: finish,

    getOwnerView: ownerView,
    async setUpKeeper(name) {
      const state = await keeper(name);
      if (state.reserve) return;
      await ownerAct(name, () =>
        sign(state.keeper, [{ methodName: "prepare", args: { name }, deposit: state.setup_cost }]),
      );
    },
    async configureKeeper(name, enabled, share_bps) {
      const state = await keeper(name);
      if (!state.collector) throw new Error("Set Keeper up for this name first.");
      const { collector } = state;
      // The name's wallet has to accept the collector and cap what it can move before Keeper is switched on.
      const calls: WalletCall[] = [];
      if (!state.extension_enabled)
        calls.push(
          nameCall("w_execute_extension", {
            request: { internal: [{ op: "add_extension", payload: { account_id: collector } }] },
          }),
        );
      if (!state.granted)
        calls.push(
          nameCall("hos_grant_spend", {
            extension: collector,
            receivers: [collector],
            budget_yocto: state.rent,
            tokens: [],
            items: [],
            expires_at: state.grant_expires_ns,
          }),
        );
      calls.push(asName(state.keeper, "configure", { enabled, share_bps, puller: state.owner }, "20000000000000"));
      await ownerAct(name, () => sign(name, calls));
    },
    async topUp(name, amount) {
      const state = await keeper(name);
      if (!state.reserve) throw new Error("Set Keeper up for this name first.");
      await ownerAct(name, () => sign(state.keeper, [{ methodName: "top_up", args: { name }, deposit: amount }]));
    },
    async withdraw(name, amount) {
      const state = await keeper(name);
      await ownerAct(name, () => sign(name, [asName(state.keeper, "withdraw", { amount }, "50000000000000")]));
    },
    async renew(name) {
      const state = await keeper(name);
      await ownerAct(name, () => sign(state.keeper, [{ methodName: "renew", args: { name } }]));
    },
  };
}
