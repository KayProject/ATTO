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
