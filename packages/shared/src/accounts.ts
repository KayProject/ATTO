// Mirror of contracts/shared/src/accounts.rs. Sandbox names come from the environment.

export type NetworkId = "mainnet" | "testnet" | "sandbox";

export interface NetworkAccounts {
  rpc: string;
  registry: string;
  hosExtension: string;
  intents: string;
  escrow: string | null;
  keeper: string | null;
}

export const MAINNET: NetworkAccounts = {
  rpc: "https://rpc.mainnet.fastnear.com",
  registry: "registry.hos",
  hosExtension: "ext.hos",
  intents: "intents.near",
  escrow: null,
  keeper: null,
};

/** Reads sandbox (or overridden) accounts from ATTO_* variables. */
export function accountsFromEnv(env: Record<string, string | undefined>): { network: NetworkId; accounts: NetworkAccounts } {
  const network = (env.ATTO_NETWORK ?? "mainnet") as NetworkId;
  const base = network === "mainnet" ? MAINNET : null;
  const pick = (key: string, fallback: string | null | undefined) => env[key] ?? fallback ?? null;
  const required = (key: string, fallback: string | null | undefined) => {
    const v = pick(key, fallback);
    if (!v) throw new Error(`${key} must be set for network ${network}`);
    return v;
  };
  return {
    network,
    accounts: {
      rpc: required("ATTO_RPC", base?.rpc),
      registry: required("ATTO_REGISTRY", base?.registry),
      hosExtension: required("ATTO_HOS_EXTENSION", base?.hosExtension),
      intents: required("ATTO_INTENTS", base?.intents),
      escrow: pick("ATTO_ESCROW", base?.escrow),
      keeper: pick("ATTO_KEEPER", base?.keeper),
    },
  };
}
