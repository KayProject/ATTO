// Which data the site runs on: the in-memory mock, or the real contracts on a local sandbox.
export type Backend = "mock" | "sandbox";
export const BACKEND: Backend = process.env.NEXT_PUBLIC_ATTO_BACKEND === "sandbox" ? "sandbox" : "mock";
