import { accountsFromEnv, type NetworkAccounts, type NetworkId } from "@atto/shared";

export function validateName(value: string): string {
  const name = value.trim().toLowerCase();
  if (name.length > 64 || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*(?:\.[a-z0-9]+(?:[-_][a-z0-9]+)*)+$/.test(name))
    throw new Error("Enter a complete NEAR name, such as near.pay.");
  return name;
}
export class Rpc {
  constructor(
    public accounts: NetworkAccounts,
    public network: NetworkId = "mainnet",
  ) {}
  static fromEnv() {
    const { accounts, network } = accountsFromEnv(process.env);
    return new Rpc(accounts, network);
  }
  async call<T = unknown>(method: string, params: object): Promise<T> {
    const response = await fetch(this.accounts.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "atto", method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.cause?.name ?? body.error.message ?? "RPC read refused");
    return body.result as T;
  }
  query<T>(account_id: string, request_type: string, extra = {}) {
    return this.call<T>("query", { account_id, request_type, finality: "final", ...extra });
  }
  async view<T = unknown>(account: string, method: string, args = {}): Promise<T> {
    const response = await this.query<{ result: number[] }>(account, "call_function", {
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(response.result).toString());
  }
}
export function splitName(name: string) {
  const parts = name.split(".");
  return { tla_id: parts.slice(1).join("."), name: parts[0]! };
}
export function nsDate(value: string) {
  return new Date(Number(BigInt(value) / 1_000_000n)).toISOString();
}
export function nearAmount(value: string) {
  const n = BigInt(value);
  return `${n / 10n ** 24n}.${(n % 10n ** 24n).toString().padStart(24, "0").slice(0, 4)} NEAR`;
}
