import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SECTION_KEYS, type Report } from "@atto/shared";
import { describe, expect, it } from "vitest";
import { World } from "@/lib/atto/mock/world";
import { platLinks, ReportSections } from "./report";

/** A report shaped like Title Search's: no clearing index on its lines, NFT labels as contract/token. */
function titleSearchReport(): Report {
  const report = structuredClone(new World().getReport("bakery.food")!);
  report.manifest.intents_keys = ["ed25519:key"];
  report.manifest.nfts = [{ contract_id: "art.near", token_id: "17" }];
  const line = { detail: "", rating: "WillBeCleared" as const };
  report.sections.intents_keys.lines = [{ ...line, label: "ed25519:key" }];
  report.sections.nfts.lines = [{ ...line, label: "art.near/17" }];
  report.sections.sub_accounts.lines = [{ label: "shop.bakery.food", detail: "", rating: "NeedsSeller" }];
  report.sections.dao_roles.lines = [];
  report.sections.intents_mode.lines = [];
  return report;
}

const cut = (report: Report, upto: number) =>
  platLinks(report, upto)
    .filter((link) => link.cut)
    .map((link) => link.id);

describe("the drawing's cut lines", () => {
  it("follows the escrow's order on a real report: keys, then NFTs", () => {
    const report = titleSearchReport();
    expect(cut(report, 0)).toEqual([]);
    expect(cut(report, 1)).toEqual(["intents_keys:ed25519:key"]);
    expect(cut(report, 2)).toEqual(["intents_keys:ed25519:key", "nfts:art.near/17"]);
  });

  it("never marks what the escrow can't clear", () => {
    expect(cut(titleSearchReport(), 99)).not.toContain("sub_accounts:shop.bakery.food");
  });

  it("still works on the mock's reports", () => {
    const report = new World().getReport("bakery.food")!;
    expect(cut(report, 99)).toHaveLength(2);
  });
});

describe("report disclosure", () => {
  it("keeps every category and seller instruction available, with risky categories open", () => {
    const report = new World().getReport("bakery.food")!;
    const html = renderToStaticMarkup(createElement(ReportSections, { report }));
    expect(html.match(/<details/g)).toHaveLength(SECTION_KEYS.length);
    for (const key of SECTION_KEYS) {
      const section = report.sections[key];
      expect(html).toContain(section.title.replaceAll("'", "&#x27;"));
      for (const line of section.lines) {
        if (line.ask_seller) expect(html).toContain(line.ask_seller.replaceAll("'", "&#x27;"));
      }
      if (section.lines.some((line) => line.rating === "NeedsSeller")) {
        expect(html).toContain(`<details class="report-section" open=""><summary><span>${section.title}</span>`);
      }
    }
  });
  it("exposes unavailable evidence without an empty reassurance", () => {
    const report = new World().getReport("clean.pay")!;
    report.sections.nfts = {
      title: "NFT evidence",
      status: "unavailable",
      lines: [],
      note: "The reader did not respond.",
    };
    const html = renderToStaticMarkup(createElement(ReportSections, { report }));
    expect(html).toContain('<details class="report-section" open=""><summary><span>NFT evidence</span>');
    expect(html).toContain("Unavailable right now.");
    expect(html).toContain("The reader did not respond.");
    expect(html).toContain("None found");
  });
});
