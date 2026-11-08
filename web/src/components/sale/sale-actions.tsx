import type { ReactNode } from "react";
import type { ListingState } from "@atto/shared";
export function SaleActions({ state, children }: { state: ListingState; children: ReactNode }) {
  return (
    <div className="ticket-panel stack" role="region" aria-label={`${state} sale actions`} aria-live="polite">
      {children}
    </div>
  );
}
