import { describe, expect, it } from "vitest";
import { hasAcceptedReport, reportAcceptanceKey } from "./report-acceptance";
describe("sale report acceptance", () => {
  it("does not carry consent to another listing, report or acting account", () => {
    const accepted = reportAcceptanceKey("1", "buyer.near", "first");
    expect(hasAcceptedReport(accepted, "1", "buyer.near", "first")).toBe(true);
    expect(hasAcceptedReport(accepted, "2", "buyer.near", "first")).toBe(false);
    expect(hasAcceptedReport(accepted, "1", "buyer.near", "changed")).toBe(false);
    expect(hasAcceptedReport(accepted, "1", "other.near", "first")).toBe(false);
    expect(hasAcceptedReport(null, "1", "buyer.near", "first")).toBe(false);
  });
});
