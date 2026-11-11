// Public reads for the Check API, from whichever backend the site runs on.
import { BACKEND } from "./backend";
import { mainnet } from "./mainnet/server";
import { getWorld } from "./mock/singleton";
import { sandbox } from "./sandbox";

export const reads =
  BACKEND === "mainnet"
    ? mainnet
    : BACKEND === "sandbox"
      ? sandbox
      : {
        getReport: async (name: string) => getWorld().getReport(name),
        getHistory: async (name: string) => getWorld().getHistory(name),
        changedOwner: async (name: string, days: number) => getWorld().changedOwner(name, days),
      };
