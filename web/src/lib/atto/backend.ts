// Which data the site runs on: the in-memory mock, or the real contracts on a local sandbox.
export type Backend = "mock" | "sandbox";
export const BACKEND: Backend = process.env.NEXT_PUBLIC_ATTO_BACKEND === "sandbox" ? "sandbox" : "mock";

/** On the mock, names it doesn't hold get a real, read-only report from NEAR mainnet. Off by default. */
export const LIVE_REPORTS = BACKEND === "mock" && process.env.NEXT_PUBLIC_ATTO_LIVE_REPORTS === "1";
