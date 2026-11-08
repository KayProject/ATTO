import type { ListingState } from "@atto/shared";
import type { SaleView } from "@/lib/atto/types";
const STEPS: { state: ListingState; label: string }[] = [
  { state: "Listed", label: "Listed" },
  { state: "Paid", label: "Paid" },
  { state: "NameHeld", label: "Name in escrow" },
  { state: "Clearing", label: "Cutting leftovers" },
  { state: "Verified", label: "Checks passed" },
  { state: "Completed", label: "Completed" },
];

export function SaleProgress({ sale }: { sale: SaleView }) {
  const { state, failure, name_at, paid_at } = sale.listing;
  const stopped = state === "Reversed" || state === "Cancelled";
  // A stopped sale marks how far it got, using what it recorded on the way.
  const reached = stopped ? (name_at ? (failure ? 3 : 2) : paid_at ? 1 : 0) : STEPS.findIndex((s) => s.state === state);
  return (
    <ol className="steps" aria-label="Sale progress">
      {STEPS.map((step, i) => {
        const finished = state === "Completed" && i === reached;
        const status = i < reached || finished ? "done" : i === reached ? (stopped ? "failed" : "now") : "todo";
        return (
          <li
            className="step"
            key={step.state}
            data-state={status}
            aria-current={status === "now" ? "step" : undefined}
          >
            <span className="small">
              {i + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
