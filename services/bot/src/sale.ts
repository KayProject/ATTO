import type { Listing, Report } from "@atto/shared";
export interface SaleDriver {
  getListing(id: string): Promise<Listing | null>;
  report(name: string): Promise<Report>;
  postManifest(id: string, report: Report): Promise<void>;
  clear(id: string, count: number): Promise<void>;
  verify(id: string): Promise<void>;
  complete(id: string): Promise<void>;
  reverse(id: string): Promise<void>;
}
export async function driveSale(driver: SaleDriver, id: string) {
  let listing = await driver.getListing(id);
  if (!listing) throw new Error("Listing not found.");
  if (listing.state === "NameHeld") {
    const report = await driver.report(listing.token_id);
    if (!report.clean_sale.supported) return { state: "blocked", reason: report.clean_sale.reason };
    if (report.fingerprint !== listing.accepted_fingerprint) return { state: "buyer_acceptance_required", report };
    await driver.postManifest(id, report);
    listing = (await driver.getListing(id))!;
  }
  if (listing.state === "Clearing") {
    const count = (listing.manifest?.intents_keys.length ?? 0) + (listing.manifest?.nfts.length ?? 0);
    for (let at = listing.cleared_upto; at < count; at += 10) await driver.clear(id, 10);
    await driver.verify(id);
    listing = (await driver.getListing(id))!;
    if (listing.failure) {
      await driver.reverse(id);
      return { state: "Reversed", reason: listing.failure };
    }
  }
  if (listing.state === "Verified") await driver.complete(id);
  return { state: (await driver.getListing(id))?.state };
}
