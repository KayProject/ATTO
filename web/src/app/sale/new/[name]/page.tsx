import { Suspense } from "react";
import { NewSaleView } from "./new-sale-view";

export const metadata = { title: "List a name" };

export default function NewSalePage({ params }: { params: Promise<{ name: string }> }) {
  return (
    <Suspense fallback={<p className="frame soft">Loading the report…</p>}>
      <NewSaleView params={params} />
    </Suspense>
  );
}
