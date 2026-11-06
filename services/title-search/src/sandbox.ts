import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { Report, NftRef } from "@atto/shared";
import { Rpc } from "./rpc";
import { direct } from "./direct";
import { rate } from "./rate";
export interface FixtureRuntime {
  name: string;
  rpcUrl: string;
}
interface Fixture {
  name: string;
  rpcUrl?: string;
  nfts?: NftRef[];
  subaccounts?: { accountId: string; sellerHeldKey: string; provenance: string }[];
  daoRoles?: string[];
  completeWithinFixture: boolean;
  note?: string;
  scope?: string;
}
export async function fixtureReport(r: FixtureRuntime, rpc: Rpc, path: string, final = false): Promise<Report> {
  const fixture = JSON.parse(readFileSync(resolve(dirname(path), "fixture.json"), "utf8")) as Fixture;
  if (!Array.isArray(fixture.nfts) || !Array.isArray(fixture.subaccounts) || !Array.isArray(fixture.daoRoles))
    throw new Error("The fixture inventory is incomplete.");
  if (
    fixture.name !== r.name ||
    fixture.completeWithinFixture !== true ||
    (fixture.rpcUrl && fixture.rpcUrl !== r.rpcUrl)
  )
    throw new Error("The sandbox fixture provenance is missing or does not match this runtime. Rebuild the fixture.");
  const d = await direct(r.name, rpc);
  const sections = d.sections;
  sections.history = {
    title: "Fixture provenance",
    status: "filled",
    lines: [
      {
        label: "Bounded sandbox fixture",
        detail: fixture.note ?? fixture.scope ?? "Known local deployment fixture. Not a general sandbox history index.",
        rating: "Clean",
      },
    ],
  };
  sections.dao_roles = {
    title: "DAO roles",
    status: fixture.daoRoles?.length ? "filled" : "none_found",
    lines: (fixture.daoRoles ?? []).map((role) => ({
      label: role,
      detail: "Disclosed by the local fixture.",
      rating: "NeedsSeller",
      ask_seller: "Remove the role or explicitly disclose it to the buyer.",
    })),
  };
  sections.sub_accounts = {
    title: "Sub-accounts",
    status: fixture.subaccounts?.length ? "filled" : "none_found",
    lines: [],
  };
  for (const childEntry of fixture.subaccounts ?? []) {
    if (typeof childEntry.accountId !== "string" || !childEntry.accountId.endsWith("." + r.name))
      throw new Error("Malformed fixture sub-account");
    const child = childEntry.accountId;
    const keys = await rpc.query<{ keys: unknown[] }>(child, "view_access_key_list");
    sections.sub_accounts.lines.push({
      label: child,
      detail: `${keys.keys.length} access keys remain under separate control.`,
      rating: "NeedsSeller",
      ask_seller: "Transfer control of this sub-account separately or accept it as excluded from the sale.",
    });
  }
  sections.nfts = { title: "NFTs and approvals", status: fixture.nfts?.length ? "filled" : "none_found", lines: [] };
  for (const nft of fixture.nfts ?? []) {
    const token = await rpc.view<{ owner_id: string; approved_account_ids: Record<string, unknown> }>(
      nft.contract_id,
      "nft_token",
      { token_id: nft.token_id },
    );
    if (token.owner_id !== r.name) throw new Error("A fixture NFT moved away from the name.");
    const approvals = Object.keys(token.approved_account_ids);
    sections.nfts.lines.push({
      label: `${nft.contract_id}/${nft.token_id}`,
      detail: approvals.length ? `Approved to ${approvals.join(", ")}` : "No approvals remain.",
      rating: approvals.length ? "WillBeCleared" : "Clean",
    });
  }
  const value = rate(
    r.name,
    "sandbox",
    sections,
    [`${r.rpcUrl} finalized RPC`, "Explicit local fixture inventory; not a public-network discovery guarantee."],
    fixture.nfts ?? [],
    final,
  );
  return value;
}
