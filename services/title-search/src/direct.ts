import type { ReportSection, SectionKey } from "@atto/shared";
import { Rpc, splitName, nsDate, nearAmount } from "./rpc";
export type Sections = Partial<Record<SectionKey, ReportSection>>;
export interface RegistryName {
  full_name: string;
  owner: string;
  payout_account: string;
  lifecycle: string;
  expires_at: string;
  annual_rent: string;
  rented_at: string;
}
export const unavailable = (title: string, reason: string): ReportSection => ({
  title,
  status: "unavailable",
  lines: [],
  note: reason,
});
const clean = (label: string, detail: string) => ({ label, detail, rating: "Clean" as const });
export async function direct(
  name: string,
  rpc: Rpc,
): Promise<{ sections: Sections; registered: RegistryName | null; issues: string[] }> {
  const sections: Sections = {};
  const issues: string[] = [];
  async function read(key: SectionKey, title: string, fn: () => Promise<ReportSection>) {
    try {
      sections[key] = await fn();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Read failed";
      sections[key] = unavailable(title, `Finalized RPC read unavailable: ${reason}. Try again before paying.`);
      issues.push(key);
    }
  }
  let registered: RegistryName | null = null;
  await read("owner", "Owner and payout", async () => {
    registered = await rpc.view<RegistryName | null>(rpc.accounts.registry, "get_sub_account", splitName(name));
    if (!registered) throw new Error("This name is not registered in the configured registry");
    if (
      typeof registered.owner !== "string" ||
      typeof registered.payout_account !== "string" ||
      typeof registered.lifecycle !== "string" ||
      typeof registered.expires_at !== "string" ||
      !/^\d+$/.test(registered.expires_at)
    )
      throw new Error("Malformed registry response");
    return {
      title: "Owner and payout",
      status: "filled",
      lines: [
        clean("Registry owner", registered.owner),
        clean("Payout account", registered.payout_account),
        {
          label: "Registry lifecycle",
          detail: registered.lifecycle,
          rating: registered.lifecycle === "Active" ? "Clean" : "NeedsSeller",
          ask_seller: "Restore an active registration before listing.",
        },
      ],
      note: "The name wallet’s spare NEAR goes to the seller on handover. Payments arriving while escrow holds the name stay for the buyer.",
    };
  });
  await Promise.all([
    read("lease", "Lease", async () => {
      const l = await rpc.view<{ lease_until_ns: string; state: string; frozen: unknown }>(name, "hos_lease");
      if (typeof l.lease_until_ns !== "string" || !/^\d+$/.test(l.lease_until_ns) || typeof l.state !== "string")
        throw new Error("Malformed lease response");
      const tla = await rpc.view<{ tla_type: string } | null>(rpc.accounts.registry, "get_tla", {
        tla_id: splitName(name).tla_id,
      });
      if (!tla || typeof tla.tla_type !== "string") throw new Error("TLA type unavailable");
      const resale =
        tla.tla_type !== "Business" ||
        (await rpc.view<boolean>(rpc.accounts.registry, "is_business_resale_enabled", {
          tla_id: splitName(name).tla_id,
        }));
      return {
        title: "Lease",
        status: "filled",
        lines: [
          {
            label: "Expires",
            detail: nsDate(l.lease_until_ns),
            rating: BigInt(l.lease_until_ns) < BigInt(Date.now() + 72 * 3600000) * 1_000_000n ? "NeedsSeller" : "Clean",
            ask_seller: "Renew the lease beyond the 72-hour sale window.",
          },
          {
            label: "Wallet state",
            detail: l.state,
            rating: l.state === "Active" ? "Clean" : "NeedsSeller",
            ask_seller: "Restore an active wallet state before listing.",
          },
          {
            label: "Freeze state",
            detail: JSON.stringify(l.frozen),
            rating: l.frozen === "Unfrozen" ? "Clean" : "NeedsSeller",
            ask_seller: "Unfreeze the name before listing.",
          },
          {
            label: "Resale permission",
            detail: resale === true ? "Allowed" : "Not allowed",
            rating: resale === true ? "Clean" : "NeedsSeller",
            ask_seller: "The business ending must enable resale before this name can be sold.",
          },
        ],
        note: `Frozen state: ${JSON.stringify(l.frozen)}`,
      };
    }),
    read("wallet", "Wallet NEAR", async () => {
      const a = await rpc.query<{ amount: string; locked: string }>(name, "view_account");
      if (
        typeof a.amount !== "string" ||
        typeof a.locked !== "string" ||
        !/^\d+$/.test(a.amount) ||
        !/^\d+$/.test(a.locked)
      )
        throw new Error("Malformed wallet account response");
      const allowed = await rpc.view<string[]>(rpc.accounts.registry, "get_ft_allowlist");
      if (!Array.isArray(allowed) || allowed.some((v) => typeof v !== "string"))
        throw new Error("Malformed token allowlist");
      const contracts = new Set(allowed);
      if (rpc.network === "mainnet") {
        const response = await fetch(`https://api.fastnear.com/v1/account/${encodeURIComponent(name)}/full`, {
          headers: process.env.FASTNEAR_API_KEY ? { Authorization: `Bearer ${process.env.FASTNEAR_API_KEY}` } : {},
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Fungible-token discovery is unavailable");
        const snapshot = await response.json();
        if (!Array.isArray(snapshot.tokens)) throw new Error("Malformed token discovery");
        for (const token of snapshot.tokens) {
          if (typeof token.contract_id !== "string") throw new Error("Malformed token contract");
          contracts.add(token.contract_id);
        }
      }
      const lines: ReportSection["lines"] = [
        clean("Balance", nearAmount(a.amount)),
        clean("Locked", nearAmount(a.locked)),
      ];
      for (const contract of [...contracts].sort()) {
        const balance = await rpc.view<string>(contract, "ft_balance_of", { account_id: name });
        if (typeof balance !== "string" || !/^\d+$/.test(balance))
          throw new Error(`Malformed FT balance from ${contract}`);
        lines.push(
          BigInt(balance) > 0n
            ? {
                label: contract,
                detail: `${balance} base units; wallet token balances are outside the accepted manifest.`,
                rating: "NeedsSeller",
                ask_seller:
                  "Settle this wallet token balance separately before the name sale. ATTO does not verify wallet FT balance floors.",
              }
            : clean(contract, `${balance} base units`),
        );
      }
      return {
        title: "Wallet NEAR and tokens",
        status: "filled",
        lines,
        note: "Fungible tokens: registry allowlist plus FastNEAR snapshot discovery. Amounts are base units, without decimal conversion. Tokens outside these sources may be undiscovered.",
      };
    }),
    read("name_keys", "Name access keys", async () => {
      const v = await rpc.query<{ keys: { public_key: string; access_key: unknown }[] }>(name, "view_access_key_list");
      return {
        title: "Name access keys",
        status: v.keys.length ? "filled" : "none_found",
        lines: v.keys.map((k) => ({
          label: k.public_key,
          detail: JSON.stringify(k.access_key),
          rating: "NeedsSeller",
          ask_seller: "Resolve access keys on the name before listing it.",
        })),
      };
    }),
    read("intents_keys", "Intents signing keys", async () => {
      const keys = await rpc.view<string[]>(rpc.accounts.intents, "public_keys_of", { account_id: name });
      if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string"))
        throw new Error("Malformed Intents key list");
      return {
        title: "Intents signing keys",
        status: keys.length ? "filled" : "none_found",
        lines: keys.sort().map((k) => ({
          label: k,
          detail: "Can sign Intents messages. Date added is unavailable without transaction history.",
          rating: "WillBeCleared",
        })),
      };
    }),
    read("intents_mode", "Intents authentication", async () => {
      const enabled = await rpc.view<boolean>(rpc.accounts.intents, "is_auth_by_predecessor_id_enabled", {
        account_id: name,
      });
      if (typeof enabled !== "boolean") throw new Error("Malformed authentication response");
      return {
        title: "Intents authentication",
        status: "filled",
        lines: [
          {
            label: enabled ? "Account calls enabled" : "Signed messages only",
            detail: enabled
              ? "The name can remove its Intents keys by direct call."
              : "The escrow cannot remove keys by direct account calls.",
            rating: enabled ? "Clean" : "NeedsSeller",
            ask_seller: enabled
              ? undefined
              : "Enable predecessor authentication using a signed intent before the sale.",
          },
        ],
      };
    }),
    read("intents_balances", "Intents balances", async () => {
      const ids: string[] = [];
      for (let offset = 0; offset < 10_000; offset += 100) {
        const page = await rpc.view<{ token_id: string }[]>(rpc.accounts.intents, "mt_tokens_for_owner", {
          account_id: name,
          from_index: String(offset),
          limit: 100,
        });
        if (!Array.isArray(page) || page.length > 100) throw new Error("Malformed Intents token enumeration");
        for (const item of page) {
          if (typeof item.token_id !== "string" || ids.includes(item.token_id))
            throw new Error("Malformed or repeated Intents token");
          ids.push(item.token_id);
        }
        if (page.length < 100) {
          const lines = await Promise.all(
            ids.sort().map(async (token_id) => {
              const amount = await rpc.view<string>(rpc.accounts.intents, "mt_balance_of", {
                account_id: name,
                token_id,
              });
              if (typeof amount !== "string" || !/^\d+$/.test(amount))
                throw new Error("Malformed Intents token balance");
              return clean(token_id, amount);
            }),
          );
          return { title: "Intents balances", status: lines.length ? "filled" : "none_found", lines };
        }
      }
      throw new Error("Balance enumeration exceeded the safety limit");
    }),
    read("keeper_reserve", "Keeper reserve", async () => {
      if (!rpc.accounts.keeper) return unavailable("Keeper reserve", "No Keeper is deployed on this network.");
      const v = await rpc.view<{ balance: string; enabled: boolean } | null>(rpc.accounts.keeper, "get_reserve", {
        name,
      });
      return {
        title: "Keeper reserve",
        status: v ? "filled" : "none_found",
        lines: v
          ? [clean("Reserve", nearAmount(v.balance)), clean("Automatic renewal", v.enabled ? "Enabled" : "Disabled")]
          : [],
      };
    }),
  ]);
  return { sections, registered, issues };
}
