// Public reads for the Check API, from whichever backend the site runs on.
import { BACKEND, WALLET } from "./backend";
import { mainnet } from "./mainnet/server";
import { getWorld } from "./mock/singleton";
import { sandbox } from "./sandbox";

export const reads =
  WALLET
    ? mainnet
    : BACKEND === "sandbox"
      ? sandbox
      : {
        getReport: async (name: string) => getWorld().getReport(name),
        getHistory: async (name: string) => getWorld().getHistory(name),
        changedOwner: async (name: string, days: number) => getWorld().changedOwner(name, days),
      };
