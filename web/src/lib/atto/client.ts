// The browser's AttoClient. The server answers from the mock, the local sandbox or NEAR mainnet.
import { KEEPER_NETWORK, NETWORK, WALLET, type Network } from "./backend";
import { mainnetClient } from "./mainnet/client";
import { walletAccount, walletSend } from "./mainnet/wallet";
import { PERSONAS, type PersonaKey } from "./mock/seeds";
import type { AttoClient } from "./types";

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

const served: AttoClient = {
  getReport: (name) => call("getReport", { name }),
  getHistory: (name) => call("getHistory", { name }),
  changedOwner: (name, days) => call("changedOwner", { name, days }),
  sampleNames: () => call("sampleNames"),
  ownedBy: () => call("ownedBy"),
  openSales: () => call("openSales"),
  mySales: () => call("mySales"),
  getSale: (id) => call("getSale", { id }),
  list: (token_id, price) => call("list", { token_id, price }),
  delist: (id) => call("delist", { id }),
  pay: (id, fingerprint) => call("pay", { id, fingerprint }),
  cancel: (id) => call("cancel", { id }),
  reclaimPayment: (id) => call("reclaimPayment", { id }),
  handOver: (id) => call("handOver", { id }),
  acceptChangedReport: (id) => call("acceptChangedReport", { id }),
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

/** Mock-only tools for the bar at the top of the page. */
export const mockTools = {
  advanceClock: (hours: number) => call<string>("advanceClock", { hours }),
  reset: () => call("resetWorld"),
};
