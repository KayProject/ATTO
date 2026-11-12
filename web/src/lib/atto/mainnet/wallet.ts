// The visitor's own NEAR wallet, one connection per network. Browser only: nothing here runs on the server.
import type { NearConnector } from "@hot-labs/near-connect";
import { NETWORK, type Network } from "../backend";

const GAS = "300000000000000";
const DEFAULT: Network = NETWORK ?? "mainnet";
const connectors = new Map<Network, Promise<NearConnector>>();
const accounts = new Map<Network, string | null>();
const listeners = new Set<() => void>();

function setAccount(network: Network, next: string | null) {
  if (next === (accounts.get(network) ?? null)) return;
  accounts.set(network, next);
  listeners.forEach((notify) => notify());
}

function getConnector(network: Network) {
  let connector = connectors.get(network);
  if (!connector) {
    connector = import("@hot-labs/near-connect").then(({ NearConnector }) => {
      const c = new NearConnector({ network, autoConnect: true });
      c.on("wallet:signIn", (event) => setAccount(network, event.accounts[0]?.accountId ?? null));
      c.on("wallet:signOut", () => setAccount(network, null));
      return c;
    });
    connectors.set(network, connector);
  }
  return connector;
}

/** Picks up a wallet session left from an earlier visit. */
export async function restoreWallet(network: Network = DEFAULT) {
  try {
    const { accounts: found } = await (await getConnector(network)).getConnectedWallet();
    setAccount(network, found[0]?.accountId ?? null);
  } catch {
    setAccount(network, null);
  }
}

export async function connectWallet(network: Network = DEFAULT) {
  const wallet = await (await getConnector(network)).connect();
  setAccount(network, (await wallet.getAccounts())[0]?.accountId ?? null);
}

export async function disconnectWallet(network: Network = DEFAULT) {
  await (await getConnector(network)).disconnect();
  setAccount(network, null);
}

export const walletAccount = (network: Network = DEFAULT) => accounts.get(network) ?? null;
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
export async function walletSend(receiverId: string, calls: WalletCall[], network: Network = DEFAULT) {
  const signerId = walletAccount(network);
  if (!signerId) throw new Error(`Connect your ${network} wallet first.`);
  try {
    const { wallet } = await (await getConnector(network)).getConnectedWallet();
    await wallet.signAndSendTransaction({
      signerId,
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
