// Which data the site runs on: the in-memory mock, the real contracts on a local sandbox,
// or the deployed contracts on NEAR mainnet or testnet with the visitor's own wallet.
export type Backend = "mock" | "sandbox" | "mainnet" | "testnet";
const chosen = process.env.NEXT_PUBLIC_ATTO_BACKEND;
export const BACKEND: Backend =
  chosen === "sandbox" || chosen === "mainnet" || chosen === "testnet" ? chosen : "mock";

/** The NEAR network the wallet modes talk to, null when no wallet is involved. */
export const NETWORK: "mainnet" | "testnet" | null =
  BACKEND === "mainnet" || BACKEND === "testnet" ? BACKEND : null;

/** True when transactions are approved in the visitor's own wallet. */
export const WALLET = NETWORK !== null;

/** Real, read-only reports from the wallet network. Always on for a wallet backend, opt-in on the mock. */
export const LIVE_REPORTS =
  WALLET || (BACKEND === "mock" && process.env.NEXT_PUBLIC_ATTO_LIVE_REPORTS === "1");

export type Network = "mainnet" | "testnet";

/** Keeper is deployed on testnet only, so a mainnet site runs its owner pages against testnet. */
export const KEEPER_NETWORK: Network | null = NETWORK === "mainnet" ? "testnet" : NETWORK;

/** A name with a working reserve, shown to visitors who own no name on the Keeper network. */
export const KEEPER_EXAMPLE = KEEPER_NETWORK === "testnet" ? "attotestowner.attotest.testnet" : null;

/** Real names the landing page reads its example report and owner checks from. */
export const EXAMPLE_NAMES: string[] =
  NETWORK === "mainnet"
    ? ["harvest.moon", "near.pay", "trade.bot"]
    : NETWORK === "testnet"
      ? ["attotestsale.attotest.testnet", "attotesthand.attotest.testnet", "attotestcancel.attotest.testnet"]
      : [];

/** The network a page's wallet and reads belong to. */
export const networkFor = (pathname: string | null): Network | null =>
  pathname?.startsWith("/owner") ? KEEPER_NETWORK : NETWORK;
