import { Suspense } from "react";
import { SalesView } from "./sales-view";

export const metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <Suspense>
      <SalesView />
    </Suspense>
  );
}
