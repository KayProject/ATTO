import { Suspense } from "react";
import { HistoryView } from "./history-view";

export const metadata = { title: "Name history" };

export default function HistoryPage({ params }: { params: Promise<{ name: string }> }) {
  return (
    <Suspense fallback={<p className="frame soft">Loading history…</p>}>
      <HistoryView params={params} />
    </Suspense>
  );
}
