// Read-only reports for real names, from Title Search on the wallet network. Server only.
import { accountsFromEnv, type Report } from "@atto/shared";
import { Rpc, titleSearch, validateName } from "@atto/title-search";
import { NETWORK } from "./backend";
import { Refusal } from "./mock/world";

/** Title Search still builds a report for a name the registry doesn't hold, with its owner section unavailable. */
export function isRegistered(report: Report): boolean {
  return !report.sections.owner.note?.includes("not registered");
}

/** The report for a real name, null if no such name is rented. Never falls back to made-up data. */
export async function liveReport(input: string, search: typeof titleSearch = titleSearch): Promise<Report | null> {
  let name: string;
  try {
    name = validateName(input);
  } catch (error) {
    throw new Refusal(error instanceof Error ? error.message : "Enter a complete NEAR name.");
  }
  // Follow the site's backend, so a stray ATTO_NETWORK can't put the wrong network on the label.
  // The mock's live reports stay on mainnet.
  const network = NETWORK ?? "mainnet";
  const { accounts } = accountsFromEnv({ ...process.env, ATTO_NETWORK: network });
  try {
    const report = await search(name, { rpc: new Rpc(accounts, network) });
    return isRegistered(report) ? report : null;
  } catch {
    throw new Refusal("Title Search couldn't reach NEAR just now, so there's no report. Try again in a moment.");
  }
}
