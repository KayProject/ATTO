// Which data the site runs on: the in-memory mock, the real contracts on a local sandbox,
// or the deployed escrow on NEAR mainnet with the visitor's own wallet.
export type Backend = "mock" | "sandbox" | "mainnet";
const chosen = process.env.NEXT_PUBLIC_ATTO_BACKEND;
export const BACKEND: Backend = chosen === "sandbox" || chosen === "mainnet" ? chosen : "mock";

/** Real, read-only reports from NEAR mainnet. Always on mainnet, opt-in on the mock for names it doesn't hold. */
export const LIVE_REPORTS =
  BACKEND === "mainnet" || (BACKEND === "mock" && process.env.NEXT_PUBLIC_ATTO_LIVE_REPORTS === "1");
