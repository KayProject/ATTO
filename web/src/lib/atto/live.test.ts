import type { Report } from "@atto/shared";
import { describe, expect, it } from "vitest";
import { liveReport } from "./live";
import { Refusal, World } from "./mock/world";
import { clientKey, RateLimiter } from "./rate-limit";

const sample = (ownerNote?: string): Report => {
  const report = structuredClone(new World().getReport("clean.pay")!);
  report.network = "mainnet";
  report.sections.owner.note = ownerNote;
  return report;
};

describe("live reports", () => {
  it("returns the report for a registered name, always read from mainnet", async () => {
    const report = sample();
    let network: string | undefined;
    const answer = await liveReport("Clean.Pay", async (name, options) => {
      expect(name).toBe("clean.pay");
      network = options?.rpc?.network;
      return report;
    });
    expect(answer).toBe(report);
    expect(network).toBe("mainnet");
  });

  it("answers null for a name the registry doesn't hold", async () => {
    const note = "Finalized RPC read unavailable: This name is not registered in the configured registry.";
    expect(await liveReport("nobody.food", async () => sample(note))).toBeNull();
  });

  it("keeps a report whose owner read failed for another reason, so the gap stays visible", async () => {
    const note = "Finalized RPC read unavailable: RPC HTTP 503.";
    expect(await liveReport("clean.pay", async () => sample(note))).not.toBeNull();
  });

  it("refuses an incomplete name without searching", async () => {
    let searched = false;
    const search = async () => {
      searched = true;
      return sample();
    };
    await expect(liveReport("near", search)).rejects.toBeInstanceOf(Refusal);
    expect(searched).toBe(false);
  });

  it("says so when NEAR can't be reached, rather than answering with anything else", async () => {
    const down = async () => {
      throw new Error("fetch failed");
    };
    await expect(liveReport("clean.pay", down)).rejects.toThrow("couldn't reach NEAR");
  });
});

describe("rate limit", () => {
  it("allows up to the limit, then gives the seconds left in the window", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 60_000, () => now);
    expect(limiter.hit("a")).toBeNull();
    expect(limiter.hit("a")).toBeNull();
    now = 15_000;
    expect(limiter.hit("a")).toBe(45);
  });

  it("counts each address alone and starts again in the next window", () => {
    let now = 0;
    const limiter = new RateLimiter(1, 60_000, () => now);
    expect(limiter.hit("a")).toBeNull();
    expect(limiter.hit("b")).toBeNull();
    expect(limiter.hit("a")).not.toBeNull();
    now = 60_000;
    expect(limiter.hit("a")).toBeNull();
  });

  it("reads the caller from the proxy's headers", () => {
    expect(clientKey(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientKey(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
