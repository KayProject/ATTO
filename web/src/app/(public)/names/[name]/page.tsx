import { Suspense } from "react";
import { ReportView } from "./report-view";

export const metadata = { title: "Title Search" };

export default function ReportPage({ params }: { params: Promise<{ name: string }> }) {
  return (
    <Suspense fallback={<p className="frame soft">Running Title Search…</p>}>
      <ReportView params={params} />
    </Suspense>
  );
}
