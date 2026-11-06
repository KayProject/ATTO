import { Suspense } from "react";
import { PayView } from "./pay-view";

export const metadata = { title: "Pay a name" };

export default function PayPage() {
  return (
    <Suspense>
      <PayView />
    </Suspense>
  );
}
