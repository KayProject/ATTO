// The calls an owner signs to switch on share-of-earnings (ARCHITECTURE.md 6.2).
// Keeper is still a stub, so these aren't sent anywhere yet. Check the argument shapes
// against the deployed Keeper and the name's wallet before wiring this to a wallet.
export interface KeeperSetup {
  keeper: string;
  rent: string;
  /** Lease end, in nanoseconds as a decimal string. */
  leaseEnd: string;
  shareBps: number;
  puller: string;
}

export function keeperSetupCalls({ keeper, rent, leaseEnd, shareBps, puller }: KeeperSetup) {
  if (!Number.isInteger(shareBps) || shareBps < 0 || shareBps > 10_000) {
    throw new Error("share must be between 0 and 10000 basis points");
  }
  return [
    { kind: "AddExtension", args: { extension: keeper } },
    {
      kind: "hos_grant_spend",
      args: { extension: keeper, receivers: [keeper], budget_yocto: rent, tokens: [], items: [], expires_at: leaseEnd },
    },
    { kind: "configure", receiver: keeper, args: { enabled: true, share_bps: shareBps, puller } },
  ] as const;
}
