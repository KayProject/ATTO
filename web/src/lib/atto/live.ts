// Read-only reports for real names, from Title Search on NEAR mainnet. Server only.
import { accountsFromEnv, type Report } from "@atto/shared";
import { Rpc, titleSearch, validateName } from "@atto/title-search";
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
  // Fixed to mainnet, so a stray ATTO_NETWORK can't put the wrong network on the label.
  const { accounts } = accountsFromEnv({ ...process.env, ATTO_NETWORK: "mainnet" });
  try {
    const report = await search(name, { rpc: new Rpc(accounts, "mainnet") });
    return isRegistered(report) ? report : null;
  } catch {
    throw new Refusal("Title Search couldn't reach NEAR just now, so there's no report. Try again in a moment.");
  }
}
