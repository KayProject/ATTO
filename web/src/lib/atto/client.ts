// The browser's AttoClient. The server answers from the mock, the local sandbox or NEAR mainnet.
import { BACKEND, KEEPER_NETWORK, NETWORK, WALLET, type Network } from "./backend";
import { mainnetClient } from "./mainnet/client";
import { walletAccount, walletSend } from "./mainnet/wallet";
import { PERSONAS, type PersonaKey } from "./mock/seeds";
import { DECLINED, type AttoClient } from "./types";
import type { ApprovalRequest } from "@/components/ui/alert-modal";
import { formatNear } from "./format";

const STORAGE_KEY = "atto-persona";
const DEFAULT_PERSONA: PersonaKey = "seller";
let persona: PersonaKey | null = null;
const listeners = new Set<() => void>();

/** Who the mock acts as. Read once from this browser's storage, which can be blocked. */
export function getPersona(): PersonaKey {
  if (persona === null) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // The default persona still works.
    }
    persona = saved && Object.hasOwn(PERSONAS, saved) ? (saved as PersonaKey) : DEFAULT_PERSONA;
  }
  return persona;
}
export const getServerPersona = () => DEFAULT_PERSONA;

export function setPersona(p: PersonaKey) {
  persona = p;
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {
    // The choice just won't survive a reload.
  }
  listeners.forEach((notify) => notify());
}

export function subscribePersona(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** Posts one method to the server, as the wallet account on `network`. */
const caller =
  (network: Network | null) =>
  async <T,>(method: string, args: object = {}): Promise<T> => {
    const response = await fetch(`/api/atto/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ persona: getPersona(), account: network ? walletAccount(network) : null, args }),
    });
    const body = (await response.json().catch(() => null)) as { result?: T; error?: string } | null;
    if (!response.ok) throw new Error(body?.error ?? `The request failed with status ${response.status}.`);
    return body?.result as T;
  };
const call = caller(NETWORK);

// On the sandbox the server signs with throwaway keys; each signing step first waits for an approval in the page.
let approver: ((request: ApprovalRequest) => Promise<boolean>) | null = null;
export const setApprover = (fn: typeof approver) => {
  approver = fn;
};
let sandboxIds: Promise<{ escrow: string; registry: string; accounts: Record<PersonaKey, string> }> | null = null;
const ids = () => (sandboxIds ??= call("sandboxIds"));
async function signed<T>(
  persona: PersonaKey,
  contract: "escrow" | "registry",
  method: string,
  deposit: string,
  summary: string,
  run: () => Promise<T>,
  asset?: string,
): Promise<T> {
  if (BACKEND === "sandbox" && approver) {
    const info = await ids();
    const ok = await approver({ signer: info.accounts[persona], receiver: info[contract], method, deposit, summary, asset });
    if (!ok) throw new Error(DECLINED);
  }
  return run();
}
const priceOf = async (id: string) => {
  const sale = await call<{ listing: { price: string } } | null>("getSale", { id });
  return sale ? `${formatNear(sale.listing.price)} NEAR` : "";
};

const served: AttoClient = {
  getReport: (name) => call("getReport", { name }),
  getHistory: (name) => call("getHistory", { name }),
  changedOwner: (name, days) => call("changedOwner", { name, days }),
  sampleNames: () => call("sampleNames"),
  ownedBy: () => call("ownedBy"),
  openSales: () => call("openSales"),
  mySales: () => call("mySales"),
  getSale: (id) => call("getSale", { id }),
  list: (token_id, price) =>
    signed("seller", "escrow", "list", "0.05 NEAR", "Listing deposit", () =>
      call("list", { token_id, price }),
    ),
  delist: (id) => signed("seller", "escrow", "delist", "0 NEAR", "Delist", () => call("delist", { id })),
  pay: async (id, fingerprint) => {
    const price = await priceOf(id);
    return signed("buyer", "escrow", "pay", price, "Held in escrow", () =>
      call("pay", { id, fingerprint }),
    );
  },
  cancel: (id) => signed("buyer", "escrow", "cancel", "0 NEAR", "Refund", () => call("cancel", { id })),
  reclaimPayment: (id) => call("reclaimPayment", { id }),
  handOver: async (id) => {
    const sale = await call<{ listing: { token_id: string } } | null>("getSale", { id });
    return signed("seller", "escrow", "nft_transfer_call", "1 yoctoNEAR", "Name NFT", () => call("handOver", { id }), sale?.listing.token_id);
  },
  acceptChangedReport: (id) =>
    signed("buyer", "escrow", "post_manifest", "0 NEAR", "Final report", () => call("acceptChangedReport", { id })),
  reverse: (id) => call("reverse", { id }),
  finishSale: (id) => call("finishSale", { id }),
  getOwnerView: (name) => call("getOwnerView", { name }),
  configureKeeper: (name, enabled, share_bps) => call("configureKeeper", { name, enabled, share_bps }),
  topUp: (name, amount) => call("topUp", { name, amount }),
  withdraw: (name, amount) => call("withdraw", { name, amount }),
  renew: (name) => call("renew", { name }),
};

export const atto: AttoClient = WALLET
  ? mainnetClient(call, walletSend, {
      call: caller(KEEPER_NETWORK),
      sign: (receiverId, calls) => walletSend(receiverId, calls, KEEPER_NETWORK!),
    })
  : served;

/** The account each persona acts as on the current backend. */
export const personaAccounts = () => call<Record<PersonaKey, string>>("accounts");

/** Sandbox only: replays the seller's pre-sale withdrawal after the sale completes. */
export const tryOldKey = (id: string) =>
  call<{ refused: boolean; reason: string | null; balance_kept: boolean; tx_hash: string }>("tryOldKey", { id });

/** Mock-only tools for the bar at the top of the page. */
export const mockTools = {
  advanceClock: (hours: number) => call<string>("advanceClock", { hours }),
  reset: () => call("resetWorld"),
};
