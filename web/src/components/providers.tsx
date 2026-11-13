"use client";

import { useAlert } from "@/components/ui/alert-modal";
import { DECLINED } from "@/lib/atto/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { KEEPER_NETWORK, NETWORK, WALLET } from "@/lib/atto/backend";
import { getPersona, getServerPersona, personaAccounts, setPersona, subscribePersona } from "@/lib/atto/client";
import { restoreWallet, serverWalletAccount, subscribeWallet, walletAccount } from "@/lib/atto/mainnet/wallet";
import { PERSONAS, type PersonaKey } from "@/lib/atto/mock/seeds";

interface PersonaContext {
  persona: PersonaKey;
  account: string;
  /** The account that acts on the owner pages. Differs from `account` only when Keeper runs on another network. */
  ownerAccount: string;
  /** The account behind every persona on the current backend. */
  accounts: Record<PersonaKey, string>;
  setPersona: (p: PersonaKey) => void;
  /** Bumped when the mock world changes, so pages reload their data. */
  revision: number;
  refresh: () => void;
}

function mockAccounts() {
  return Object.fromEntries(Object.entries(PERSONAS).map(([k, v]) => [k, v.account])) as Record<PersonaKey, string>;
}

const Context = createContext<PersonaContext | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const persona = useSyncExternalStore(subscribePersona, getPersona, getServerPersona);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  const [accounts, setAccounts] = useState<Record<PersonaKey, string>>(() => mockAccounts());

  const wallet = useSyncExternalStore(subscribeWallet, () => (NETWORK ? walletAccount(NETWORK) : null), serverWalletAccount);
  // The owner pages can run on a different network from the rest of the site, with their own wallet.
  const keeperWallet = useSyncExternalStore(
    subscribeWallet,
    () => (KEEPER_NETWORK ? walletAccount(KEEPER_NETWORK) : null),
    serverWalletAccount,
  );

  useEffect(() => {
    if (!NETWORK) return;
    void restoreWallet(NETWORK);
    if (KEEPER_NETWORK && KEEPER_NETWORK !== NETWORK) void restoreWallet(KEEPER_NETWORK);
  }, []);
  // On the sandbox, who counts as seller follows the name, so this is re-read after every change.
  useEffect(() => {
    if (WALLET) return;
    let live = true;
    personaAccounts()
      .then((value) => live && setAccounts(value))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [revision]);

  return (
    <Context.Provider
      value={{
        persona,
        account: WALLET ? (wallet ?? "") : accounts[persona],
        ownerAccount: WALLET ? (keeperWallet ?? "") : accounts[persona],
        accounts,
        setPersona,
        revision,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function usePersona() {
  const value = useContext(Context);
  if (!value) throw new Error("usePersona needs a PersonaProvider");
  return value;
}

/** Loads data on mount and whenever the persona, the acting account or `deps` change. Optionally polls. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const { persona, account, ownerAccount, revision, refresh } = usePersona();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(load);
  const key = JSON.stringify(deps);

  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let live = true;
    const run = () =>
      latest
        .current()
        .then((value) => {
          if (!live) return;
          setData(value);
          setError(null);
        })
        .catch((e: unknown) => {
          if (live) setError(e instanceof Error ? e.message : "The request failed.");
        });
    void run();
    const timer = pollMs ? setInterval(run, pollMs) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [key, persona, account, ownerAccount, revision, pollMs]);

  return { data, error, loading: data === undefined && error === null, refresh };
}

/** Runs one user action, keeps its error, and reloads the page's data afterwards. */
export function useAction() {
  const { refresh } = usePersona();
  const { alert } = useAlert();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        const result = await action();
        refresh();
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : "The request failed.";
        setError(message);
        if (message !== DECLINED) void alert({ tone: "bad", title: "That didn't go through", body: message });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [refresh, alert],
  );

  return { run, busy, error };
}
