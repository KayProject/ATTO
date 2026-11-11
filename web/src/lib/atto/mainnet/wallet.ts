// The visitor's own NEAR wallet. Browser only: nothing here runs on the server.
import type { NearConnector } from "@hot-labs/near-connect";
import { NETWORK } from "../backend";

const GAS = "300000000000000";
let connector: Promise<NearConnector> | null = null;
let account: string | null = null;
const listeners = new Set<() => void>();

function setAccount(next: string | null) {
  if (next === account) return;
  account = next;
  listeners.forEach((notify) => notify());
}

function getConnector() {
  connector ??= import("@hot-labs/near-connect").then(({ NearConnector }) => {
    const c = new NearConnector({ network: NETWORK ?? "mainnet", autoConnect: true });
    c.on("wallet:signIn", (event) => setAccount(event.accounts[0]?.accountId ?? null));
    c.on("wallet:signOut", () => setAccount(null));
    return c;
  });
  return connector;
}

/** Picks up a wallet session left from an earlier visit. */
export async function restoreWallet() {
  try {
    const { accounts } = await (await getConnector()).getConnectedWallet();
    setAccount(accounts[0]?.accountId ?? null);
  } catch {
    setAccount(null);
  }
}

export async function connectWallet() {
  const wallet = await (await getConnector()).connect();
  setAccount((await wallet.getAccounts())[0]?.accountId ?? null);
}

export async function disconnectWallet() {
  await (await getConnector()).disconnect();
  setAccount(null);
}

export const walletAccount = () => account;
export const serverWalletAccount = () => null;

export function subscribeWallet(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** The contract's own refusal text, without the wallet and RPC wrapping around it. */
function reason(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.match(/Smart contract panicked: ([^"\n]+)/)?.[1] ?? text.slice(0, 300);
}

export interface WalletCall {
  methodName: string;
  args: object;
  deposit?: string;
  gas?: string;
}

/** Asks the connected wallet to approve one transaction of one or more calls. The visitor pays its gas and deposits. */
export async function walletSend(receiverId: string, calls: WalletCall[]) {
  if (!account) throw new Error("Connect your wallet first.");
  try {
    const { wallet } = await (await getConnector()).getConnectedWallet();
    await wallet.signAndSendTransaction({
      signerId: account,
      receiverId,
      actions: calls.map(({ methodName, args, deposit = "0", gas = GAS }) => ({
        type: "FunctionCall" as const,
        params: { methodName, args, gas, deposit },
      })),
    });
  } catch (error) {
    throw new Error(reason(error));
  }
}
