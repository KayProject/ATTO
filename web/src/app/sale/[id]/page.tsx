import { Suspense } from "react";
import { SaleRoom } from "./sale-room";

export const metadata = { title: "Clean Sale" };

export default function SalePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="frame soft">Loading the sale…</p>}>
      <SaleRoom params={params} />
    </Suspense>
  );
}
