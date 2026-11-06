import type { ListingState } from "@atto/shared";

export const STATE_LABEL: Record<ListingState, string> = {
  Listed: "waiting for a buyer",
  Paid: "paid, waiting for the name",
  NameHeld: "name held by the escrow",
  Clearing: "cutting leftovers",
  Verified: "checks passed",
  Completed: "completed",
  Reversed: "reversed",
  Cancelled: "cancelled",
};
